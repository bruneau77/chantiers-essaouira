/**
 * Calculs des lignes de devis — logique double colonne BRUT vs CLIENT.
 *
 * Concept central : chaque ligne a un prix BRUT (coût réel pour Dominique)
 * et un prix CLIENT (avec marge appliquée). La marge est PAR LIGNE pour
 * permettre des marges différentes selon le poste (matériel low-marge,
 * main d'œuvre haute-marge).
 *
 * Tout est stocké en centimes DH (entiers) pour éviter les erreurs flottantes.
 */

/**
 * Calcule les champs dérivés d'une ligne de devis.
 *
 * @param {object} ligne
 * @param {number} ligne.prixUnitaireBrutCentimes
 * @param {number} ligne.quantite - Peut être m², unités, jours selon typeMesure
 * @param {number} ligne.margePct - Pourcentage de marge (ex: 15 pour 15%)
 * @returns {object} Champs calculés
 */
export function calculerLigneDevis({ prixUnitaireBrutCentimes, quantite, margePct }) {
  const coutBrutCentimes = Math.round(prixUnitaireBrutCentimes * quantite)

  // Prix unitaire client = brut × (1 + marge%)
  const facteurMarge = 1 + margePct / 100
  const prixUnitaireClientCentimes = Math.round(prixUnitaireBrutCentimes * facteurMarge)

  // Coût client = prix unitaire client × quantité
  // (on calcule à partir du prix unitaire arrondi pour cohérence d'affichage)
  const coutClientCentimes = Math.round(prixUnitaireClientCentimes * quantite)

  const margeMontantCentimes = coutClientCentimes - coutBrutCentimes

  return {
    coutBrutCentimes,
    prixUnitaireClientCentimes,
    coutClientCentimes,
    margeMontantCentimes,
  }
}

/**
 * Calcule les totaux d'un devis à partir de toutes ses lignes.
 *
 * @param {Array} lignes - Lignes de devis avec coutBrutCentimes / coutClientCentimes
 * @returns {object} Totaux du devis
 */
export function calculerTotauxDevis(lignes) {
  const totalBrutCentimes = lignes.reduce((sum, l) => sum + l.coutBrutCentimes, 0)
  const totalClientCentimes = lignes.reduce((sum, l) => sum + l.coutClientCentimes, 0)
  const margeMontantCentimes = totalClientCentimes - totalBrutCentimes
  const margeMoyennePct = totalBrutCentimes > 0
    ? ((margeMontantCentimes / totalBrutCentimes) * 100)
    : 0

  // Décomposition par section (main_oeuvre / materiel / divers)
  const parSection = {}
  for (const ligne of lignes) {
    if (!parSection[ligne.section]) {
      parSection[ligne.section] = { brutCentimes: 0, clientCentimes: 0 }
    }
    parSection[ligne.section].brutCentimes += ligne.coutBrutCentimes
    parSection[ligne.section].clientCentimes += ligne.coutClientCentimes
  }

  return {
    totalBrutCentimes,
    totalClientCentimes,
    margeMontantCentimes,
    margeMoyennePct: parseFloat(margeMoyennePct.toFixed(2)),
    parSection,
  }
}

/**
 * Calcule les 3 paiements de l'échéancier 30/40/30 à partir du total client.
 *
 * @param {number} totalClientCentimes
 * @param {object} reglages - { pctAcompte, pctMiChantier, pctSolde }
 * @returns {object[]} 3 paiements avec montants en centimes
 */
export function calculerEcheancier(totalClientCentimes, reglages) {
  const { pctAcompte, pctMiChantier, pctSolde } = reglages

  // On calcule les 2 premiers, et le solde = total - les 2 autres pour
  // garantir que la somme des 3 = total exact (pas d'erreur d'arrondi).
  const acompte = Math.round((totalClientCentimes * pctAcompte) / 100)
  const miChantier = Math.round((totalClientCentimes * pctMiChantier) / 100)
  const solde = totalClientCentimes - acompte - miChantier

  return [
    { type: 'acompte', pourcentage: pctAcompte, montantCentimes: acompte },
    { type: 'mi_chantier', pourcentage: pctMiChantier, montantCentimes: miChantier },
    { type: 'solde', pourcentage: pctSolde, montantCentimes: solde },
  ]
}
