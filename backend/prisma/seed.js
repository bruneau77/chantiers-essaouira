/**
 * Seed Prisma — données de démonstration
 *
 * Refonte Lieu / Poste / Paiement (session 2026-05-18, voir
 * docs/JOURNAL.md). Crée :
 *  - 1 ligne Reglages (valeurs par défaut)
 *  - 4 utilisateurs (Yassine admin, Dominique admin, Rachid chef,
 *                    Pierre-Yves client sans connexion)
 *  - 1 Lieu  (L-2026-001 « Villa Pierre-Yves Laurent »)
 *  - 3 Postes couvrant les trois statuts (TERMINE / EN_COURS / A_FAIRE)
 *  - 2 Paiements (un VIREMENT solde Poste A, un CASH partiel Poste B)
 *  - 3 Dépenses (2 VALIDEE affectées à un Poste, 1 A_VALIDER globale)
 *  - 2 Budgets Lieu (un VERSEMENT global, un VERSEMENT affecté au Poste A)
 *
 * Le statut du Lieu est recalculé applicativement après création des
 * Postes (via lib/postesHelpers.recalculerStatutLieu) et doit aboutir
 * à EN_COURS (mix A_FAIRE/EN_COURS/TERMINE).
 *
 * Lancement : `npx prisma db seed` (ou indirectement via
 * `npx prisma migrate reset --force` qui appelle le seed).
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { calculerFraisEssence } from '../src/lib/fraisKm.js'
import { recalculerStatutLieu } from '../src/lib/postesHelpers.js'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Helpers de date et de calcul
// -------------------------------------------------------------------

/**
 * Retourne une Date située N jours avant maintenant.
 */
function ilYaJours(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

/**
 * Calcule la marge (montant + pourcent arrondi 2 décimales) à partir
 * d'un brut et d'un client. Logique identique à celle de routes/postes.js
 * pour garantir la cohérence des données seed avec celles créées via API.
 */
function calculerMarge(montantBrutCentimes, montantClientCentimes) {
  const margeCentimes = montantClientCentimes - montantBrutCentimes
  const margePourcent = montantBrutCentimes > 0
    ? parseFloat(((margeCentimes / montantBrutCentimes) * 100).toFixed(2))
    : 0
  return { margeCentimes, margePourcent }
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  console.log('🌱 Démarrage du seed...')

  // -------------------------------------------------------------------
  // RÉGLAGES PAR DÉFAUT
  // -------------------------------------------------------------------
  const reglages = await prisma.reglages.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })
  console.log('  ✓ Réglages par défaut')

  // -------------------------------------------------------------------
  // UTILISATEURS
  // -------------------------------------------------------------------
  const motDePasseAdmin = await bcrypt.hash('admin123', 12)
  const motDePasseChef = await bcrypt.hash('chef123', 12)

  const yassine = await prisma.utilisateur.create({
    data: {
      email: 'yassine.bruneau@gmail.com',
      motDePasseHash: motDePasseAdmin,
      prenom: 'Yassine',
      nom: 'Bruneau',
      telephone: '+33 6 42 24 76 54',
      role: 'admin',
    },
  })

  const dominique = await prisma.utilisateur.create({
    data: {
      email: 'dbruneau77@gmail.com',
      motDePasseHash: motDePasseChef,
      prenom: 'Dominique',
      nom: 'Bruneau',
      telephone: '+212 6 87 19 86 36',
      role: 'admin',
      partDefautPct: 50,
    },
  })

  // Rachid AQOUDI — correction nom + email réel (cf. JOURNAL 2026-05-18,
  // l'ancien « El Mansouri / rachid@ludimmo.ma » était une erreur dev).
  const rachid = await prisma.utilisateur.create({
    data: {
      email: 'rachid_aqoudi@hotmail.fr',
      motDePasseHash: motDePasseChef,
      prenom: 'Rachid',
      nom: 'AQOUDI',
      role: 'chef',
      partDefautPct: 50,
    },
  })

  // Pierre-Yves : client typique créé via la modale du formulaire Lieu.
  // Pas d'email, pas de mot de passe. On OMET motDePasseHash du data:{}
  // (Prisma refuse `null` explicite sur un champ optionnel quand le
  // client TS est strict — cf. galère session 2026-05-16).
  const pierreYves = await prisma.utilisateur.create({
    data: {
      prenom: 'Pierre-Yves',
      nom: 'Laurent',
      adresse: 'Essaouira',
      role: 'client',
    },
  })

  console.log('  ✓ 4 utilisateurs créés (2 admin / 1 chef / 1 client)')

  // -------------------------------------------------------------------
  // LIEU — Villa Pierre-Yves Laurent (L-2026-001)
  // -------------------------------------------------------------------
  const fraisEssenceCentimes = calculerFraisEssence({
    distanceAllerKm: 8,
    nombreAllerRetourPrevu: 12,
    reglages: {
      consommationL100km: reglages.consommationL100km,
      prixGasoilCentimes: reglages.prixGasoilCentimes,
      usureCentimesParKm: reglages.usureCentimesParKm,
      securiteAllerRetour: reglages.securiteAllerRetour,
    },
  })

  const lieu = await prisma.lieu.create({
    data: {
      reference: 'L-2026-001',
      nom: 'Villa Pierre-Yves Laurent',
      clientId: pierreYves.id,
      chefId: rachid.id,
      adresse: 'Essaouira (à compléter)',
      distanceAllerKm: 8,
      nombreAllerRetourPrevu: 12,
      fraisEssenceCentimes,
      // statut par défaut PROSPECT — sera recalculé après les Postes
    },
  })
  console.log(
    `  ✓ Lieu ${lieu.reference} créé (frais essence ${(fraisEssenceCentimes / 100).toFixed(2)} DH)`,
  )

  // -------------------------------------------------------------------
  // POSTES (3 — un par statut)
  // -------------------------------------------------------------------

  // Poste A — TERMINE et intégralement payé (réfection toiture, cas de
  // référence métier).
  const margeA = calculerMarge(1048600, 1205890)
  const posteA = await prisma.poste.create({
    data: {
      lieuId: lieu.id,
      titre: 'Réfection toiture terrasse principale',
      description: 'Retrait du carrelage ancien, étanchéité, pose carrelage neuf.',
      ordre: 1,
      statut: 'TERMINE',
      termineLe: ilYaJours(14),
      montantBrutCentimes: 1048600,
      montantClientCentimes: 1205890,
      ...margeA,
    },
  })

  // Poste B — EN_COURS, partiellement payé
  const margeB = calculerMarge(35000, 45000)
  const posteB = await prisma.poste.create({
    data: {
      lieuId: lieu.id,
      titre: '3 tables marbre + bibliothèque',
      description: 'Fabrication 3 tables en marbre + 1 bibliothèque sur mesure.',
      ordre: 2,
      statut: 'EN_COURS',
      montantBrutCentimes: 35000,
      montantClientCentimes: 45000,
      ...margeB,
    },
  })

  // Poste C — A_FAIRE, pas encore commencé
  const margeC = calculerMarge(8000, 11000)
  const posteC = await prisma.poste.create({
    data: {
      lieuId: lieu.id,
      titre: 'Contrôle piscine + dépannage électrique',
      description: 'Diagnostic + petites interventions.',
      ordre: 3,
      statut: 'A_FAIRE',
      montantBrutCentimes: 8000,
      montantClientCentimes: 11000,
      ...margeC,
    },
  })

  console.log('  ✓ 3 postes créés (A=TERMINE / B=EN_COURS / C=A_FAIRE)')

  // Recalcul du statut du Lieu d'après ses Postes (mix → EN_COURS attendu).
  // On exerce la même fonction que celle utilisée par les routes — le seed
  // doit produire une DB cohérente avec ce que produirait l'API en
  // utilisation normale.
  const nouveauStatutLieu = await recalculerStatutLieu(prisma, lieu.id)
  console.log(`  ✓ Statut du Lieu recalculé : ${nouveauStatutLieu}`)

  // -------------------------------------------------------------------
  // PAIEMENTS
  // -------------------------------------------------------------------
  await prisma.paiement.create({
    data: {
      posteId: posteA.id,
      date: ilYaJours(7),
      montantCentimes: 1205890,
      mode: 'VIREMENT',
      description: 'Solde réfection toiture',
    },
  })
  await prisma.paiement.create({
    data: {
      posteId: posteB.id,
      date: ilYaJours(3),
      montantCentimes: 20000,
      mode: 'CASH',
      description: 'Acompte début marbrerie',
    },
  })
  console.log('  ✓ 2 paiements créés (Poste A intégralement payé / Poste B partiel)')

  // -------------------------------------------------------------------
  // DÉPENSES RACHID (3 — 2 validées affectées à un Poste, 1 globale à valider)
  // -------------------------------------------------------------------
  await prisma.depense.create({
    data: {
      lieuId: lieu.id,
      posteId: posteA.id,
      saisieParId: rachid.id,
      date: ilYaJours(20),
      categorie: 'MATERIEL',
      montantCentimes: 80000,
      description: 'Ciment + sable pour étanchéité',
      fournisseur: 'Distributeur ciment Essaouira',
      estAvancePersonnelle: false,
      statut: 'VALIDEE',
      valideeParId: dominique.id,
      valideeLe: ilYaJours(18),
    },
  })
  await prisma.depense.create({
    data: {
      lieuId: lieu.id,
      posteId: posteB.id,
      saisieParId: rachid.id,
      date: ilYaJours(5),
      categorie: 'MATERIEL',
      montantCentimes: 12000,
      description: 'Bois pour bibliothèque',
      fournisseur: 'Hassan menuisier',
      estAvancePersonnelle: false,
      statut: 'VALIDEE',
      valideeParId: dominique.id,
      valideeLe: ilYaJours(4),
    },
  })
  await prisma.depense.create({
    data: {
      lieuId: lieu.id,
      saisieParId: rachid.id,
      date: ilYaJours(1),
      categorie: 'REPAS',
      montantCentimes: 2500,
      description: 'Repas équipe',
      estAvancePersonnelle: false,
      statut: 'A_VALIDER',
    },
  })
  console.log(
    '  ✓ 3 dépenses créées (2 VALIDEE affectées à un Poste / 1 A_VALIDER globale)',
  )

  // -------------------------------------------------------------------
  // BUDGETS LIEU (cash Dominique → Rachid)
  // -------------------------------------------------------------------
  await prisma.budgetLieu.create({
    data: {
      lieuId: lieu.id,
      // posteId null : versement global au Lieu
      userId: rachid.id,
      date: ilYaJours(30),
      montantCentimes: 200000,
      type: 'VERSEMENT',
      description: 'Cash global pour démarrer le lieu',
      creeParId: dominique.id,
    },
  })
  await prisma.budgetLieu.create({
    data: {
      lieuId: lieu.id,
      posteId: posteA.id, // affecté au Poste A (exerce le nouveau lien BudgetLieu.posteId)
      userId: rachid.id,
      date: ilYaJours(25),
      montantCentimes: 500000,
      type: 'VERSEMENT',
      description: 'Cash affecté à la réfection toiture',
      creeParId: dominique.id,
    },
  })
  console.log('  ✓ 2 versements budget créés (1 global / 1 affecté Poste A)')

  // -------------------------------------------------------------------
  // RÉCAP FINAL
  // -------------------------------------------------------------------
  console.log('\n✅ Seed terminé.')
  console.log('\nComptes de connexion :')
  console.log('  yassine.bruneau@gmail.com / admin123  (Yassine, admin)')
  console.log('  dbruneau77@gmail.com      / chef123   (Dominique, admin)')
  console.log('  rachid_aqoudi@hotmail.fr  / chef123   (Rachid AQOUDI, chef)')
  console.log('  Pierre-Yves Laurent       (client, pas de connexion)')
  console.log(
    `\nLieu : ${lieu.reference} — ${lieu.nom} (statut ${nouveauStatutLieu})`,
  )
  console.log('Postes :')
  console.log(`  #${posteA.id} — ${posteA.titre}  [TERMINE, payé intégralement]`)
  console.log(`  #${posteB.id} — ${posteB.titre}  [EN_COURS, partiellement payé]`)
  console.log(`  #${posteC.id} — ${posteC.titre}  [A_FAIRE, aucun paiement]`)
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
