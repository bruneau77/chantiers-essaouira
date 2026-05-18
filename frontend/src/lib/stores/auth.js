/**
 * Store d'authentification — version corrigée
 *
 * Format backend :
 *   /login   → { data: { accessToken, refreshToken, refreshExpireLe, user } }
 *   /refresh → { data: { accessToken } }      ← ne renvoie QUE le nouveau accessToken
 *   /me      → { data: { user } }             ← pour récupérer l'utilisateur après un refresh
 *   /logout  → 204
 */
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

const CLE_REFRESH = 'ludimmo_refresh_token';

const etatInitial = {
	utilisateur: null,
	accessToken: null,
	chargement: true
};

/**
 * Helper interne : récupère l'utilisateur courant via /api/auth/me
 */
async function recupererUtilisateur(accessToken) {
	try {
		const res = await fetch('/api/auth/me', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (!res.ok) return null;
		const payload = await res.json();
		const data = payload.data ?? payload;
		return data.user ?? data;
	} catch {
		return null;
	}
}

function creerStoreAuth() {
	const { subscribe, set, update } = writable(etatInitial);

	return {
		subscribe,

		/**
		 * Au démarrage de l'app : si on a un refresh token, on tente
		 * de récupérer un access token + l'utilisateur.
		 */
		async initialiser() {
			if (!browser) return;

			const refreshToken = localStorage.getItem(CLE_REFRESH);
			if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
				// Sécurité : on nettoie les valeurs corrompues d'anciennes versions
				localStorage.removeItem(CLE_REFRESH);
				update((e) => ({ ...e, chargement: false }));
				return;
			}

			try {
				// 1. On demande un nouveau access token
				const res = await fetch('/api/auth/refresh', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ refreshToken })
				});

				if (!res.ok) {
					localStorage.removeItem(CLE_REFRESH);
					update((e) => ({ ...e, chargement: false }));
					return;
				}

				const payload = await res.json();
				const data = payload.data ?? payload;
				const accessToken = data.accessToken;

				if (!accessToken) {
					localStorage.removeItem(CLE_REFRESH);
					update((e) => ({ ...e, chargement: false }));
					return;
				}

				// 2. Si le backend a aussi renvoyé un nouveau refresh token (rotation), on le sauve
				if (data.refreshToken && typeof data.refreshToken === 'string') {
					localStorage.setItem(CLE_REFRESH, data.refreshToken);
				}

				// 3. On récupère l'utilisateur (via /me, ou directement si fourni)
				const utilisateur = data.user ?? (await recupererUtilisateur(accessToken));

				if (!utilisateur) {
					localStorage.removeItem(CLE_REFRESH);
					update((e) => ({ ...e, chargement: false }));
					return;
				}

				set({
					utilisateur,
					accessToken,
					chargement: false
				});
			} catch (err) {
				console.error('Erreur initialisation auth:', err);
				localStorage.removeItem(CLE_REFRESH);
				update((e) => ({ ...e, chargement: false }));
			}
		},

		async connexion(email, motDePasse) {
			try {
				const res = await fetch('/api/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, motDePasse })
				});

				const payload = await res.json();

				if (!res.ok) {
					return {
						succes: false,
						erreur: payload.message || payload.error || 'Identifiants incorrects'
					};
				}

				const data = payload.data ?? payload;

				if (!data.refreshToken || !data.accessToken) {
					return {
						succes: false,
						erreur: 'Réponse serveur invalide'
					};
				}

				localStorage.setItem(CLE_REFRESH, data.refreshToken);
				set({
					utilisateur: data.user,
					accessToken: data.accessToken,
					chargement: false
				});

				return { succes: true };
			} catch (err) {
				return {
					succes: false,
					erreur: 'Impossible de se connecter au serveur'
				};
			}
		},

		async deconnexion() {
			const refreshToken = localStorage.getItem(CLE_REFRESH);

			if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
				try {
					await fetch('/api/auth/logout', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ refreshToken })
					});
				} catch {
					// silencieux
				}
			}

			localStorage.removeItem(CLE_REFRESH);
			set({ utilisateur: null, accessToken: null, chargement: false });
			goto('/login');
		},

		/**
		 * Rafraîchir l'access token quand il expire (appelé par apiAuth)
		 * IMPORTANT : on ne touche PAS au refreshToken en localStorage si le backend
		 * ne renvoie qu'un nouvel accessToken.
		 */
		async rafraichir() {
			if (!browser) return null;

			const refreshToken = localStorage.getItem(CLE_REFRESH);
			if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
				return null;
			}

			try {
				const res = await fetch('/api/auth/refresh', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ refreshToken })
				});

				if (!res.ok) {
					localStorage.removeItem(CLE_REFRESH);
					set({ utilisateur: null, accessToken: null, chargement: false });
					return null;
				}

				const payload = await res.json();
				const data = payload.data ?? payload;
				const accessToken = data.accessToken;

				if (!accessToken) {
					localStorage.removeItem(CLE_REFRESH);
					set({ utilisateur: null, accessToken: null, chargement: false });
					return null;
				}

				// Rotation optionnelle du refresh token (seulement si le backend en renvoie un)
				if (data.refreshToken && typeof data.refreshToken === 'string') {
					localStorage.setItem(CLE_REFRESH, data.refreshToken);
				}

				update((e) => ({
					...e,
					accessToken,
					// On ne touche pas à utilisateur, il reste celui d'avant
					...(data.user ? { utilisateur: data.user } : {})
				}));

				return accessToken;
			} catch {
				return null;
			}
		}
	};
}

export const auth = creerStoreAuth();

/**
 * Helper pour appels API authentifiés (ajoute le token automatiquement)
 * En cas de 401, tente un refresh et rejoue la requête.
 */
export async function apiAuth(url, options = {}) {
	const etat = get(auth);
	let token = etat.accessToken;

	const fairAppel = (jeton) =>
		fetch(url, {
			...options,
			headers: {
				...options.headers,
				'Content-Type': 'application/json',
				Authorization: `Bearer ${jeton}`
			}
		});

	let res = await fairAppel(token);

	if (res.status === 401) {
		const nouveauToken = await auth.rafraichir();
		if (!nouveauToken) {
			goto('/login');
			throw new Error('Session expirée');
		}
		res = await fairAppel(nouveauToken);
	}

	return res;
}
