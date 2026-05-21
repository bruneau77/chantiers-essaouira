/**
 * Seed Prisma — données de PRODUCTION Ludimmo
 *
 * Mise en service réelle (2026-05-19). Ce seed remplace les anciennes
 * données de démonstration (Villa Pierre-Yves Laurent + 3 Postes) par
 * les vrais clients et lieux de Ludimmo. Dominique créera lui-même les
 * Postes, Paiements, Dépenses et Budgets via l'interface de l'app.
 *
 * Contenu créé :
 *  - 1 ligne Reglages (valeurs par défaut)
 *  - 3 comptes de connexion : Yassine (admin), Dominique (admin),
 *    Rachid Aqoudi (chef)
 *  - 6 clients réels (role 'client', sans connexion)
 *  - 6 Lieux réels (statut PROSPECT par défaut, chef = Rachid pour tous)
 *  - AUCUN Poste / Paiement / Dépense / Budget
 *
 * Lancement : `npx prisma db seed` (ou via `npx prisma migrate reset --force`).
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

/**
 * Crée un client (Utilisateur role='client'). Pas de mot de passe :
 * un client ne se connecte pas à l'app en V1. On OMET motDePasseHash
 * du data:{} (Prisma refuse `null` explicite sur un champ optionnel
 * quand le client TS est strict). email et telephone ne sont inclus
 * que s'ils sont fournis.
 */
async function creerClient({ prenom, nom, email, telephone }) {
  const data = { prenom, nom, role: 'client' }
  if (email) data.email = email
  if (telephone) data.telephone = telephone
  return prisma.utilisateur.create({ data })
}

async function main() {
  console.log('🌱 Démarrage du seed (données de production)...')

  // -------------------------------------------------------------------
  // RÉGLAGES PAR DÉFAUT
  // -------------------------------------------------------------------
  await prisma.reglages.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })
  console.log('  ✓ Réglages par défaut')

  // -------------------------------------------------------------------
  // COMPTES DE CONNEXION (3)
  // -------------------------------------------------------------------
  const motDePasseAdmin = await bcrypt.hash('admin123', 12)
  const motDePasseChef = await bcrypt.hash('chef123', 12)

  await prisma.utilisateur.create({
    data: {
      email: 'yassine.bruneau@gmail.com',
      motDePasseHash: motDePasseAdmin,
      prenom: 'Yassine',
      nom: 'Bruneau',
      telephone: '+33 6 42 24 76 54',
      role: 'admin',
    },
  })

  await prisma.utilisateur.create({
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

  const rachid = await prisma.utilisateur.create({
    data: {
      email: 'rachid_aqoudi@hotmail.fr',
      motDePasseHash: motDePasseChef,
      prenom: 'Rachid',
      nom: 'Aqoudi',
      role: 'chef',
      partDefautPct: 50,
    },
  })

  console.log('  ✓ 3 comptes de connexion créés (2 admin / 1 chef)')

  // -------------------------------------------------------------------
  // CLIENTS RÉELS (6)
  // -------------------------------------------------------------------
  const gonzales = await creerClient({
    prenom: 'Pierre-Jean',
    nom: 'Gonzales',
    email: 'pierre-jean.gonzales@orange.fr',
    telephone: '+33671615808',
  })

  const pyPahaut = await creerClient({
    prenom: 'Pierre-Yves',
    nom: 'Pahaut',
    email: 'pypahaut@gmail.com',
    telephone: '+33609800484',
  })

  const laurentPahaut = await creerClient({
    prenom: 'Laurent',
    nom: 'Pahaut',
    email: 'laurentpahaut@gmail.com',
    telephone: '+33603355131',
  })

  const bahu = await creerClient({
    prenom: 'Christian',
    nom: 'Bahu',
    // pas d'email
    telephone: '+33609328435',
  })

  const bengaouer = await creerClient({
    prenom: 'Linda',
    nom: 'Bengaouer',
    email: 'lindab-sattva@hotmail.fr',
    // pas de téléphone
  })

  const geraldinePahaut = await creerClient({
    prenom: 'Géraldine',
    nom: 'Pahaut',
    email: 'geraldinepahaut@gmail.com',
    telephone: '+33661850614',
  })

  console.log('  ✓ 6 clients réels créés')

  // -------------------------------------------------------------------
  // LIEUX RÉELS (6)
  // -------------------------------------------------------------------
  // Tous : chef = Rachid, adresse "À compléter" (Dominique remplira via
  // l'app), pas de frais km, statut PROSPECT par défaut (aucun Poste).
  // Les références L-2026-001..006 sont posées explicitement, dans
  // l'ordre — le prochain Lieu créé via l'app sera L-2026-007.
  const lieuxAVCreer = [
    { reference: 'L-2026-001', nom: 'Villa Ounara', client: gonzales },
    { reference: 'L-2026-002', nom: 'Villa Bord de Mer', client: pyPahaut },
    { reference: 'L-2026-003', nom: 'Villa Eole', client: laurentPahaut },
    { reference: 'L-2026-004', nom: 'Villa Douar Larab', client: bahu },
    { reference: 'L-2026-005', nom: 'Appartement 2ème ligne de mer', client: bengaouer },
    { reference: 'L-2026-006', nom: 'Villa Mimosa', client: geraldinePahaut },
  ]

  const lieuxCrees = []
  for (const l of lieuxAVCreer) {
    const lieu = await prisma.lieu.create({
      data: {
        reference: l.reference,
        nom: l.nom,
        clientId: l.client.id,
        chefId: rachid.id,
        adresse: 'À compléter',
        // distanceAllerKm / nombreAllerRetourPrevu : null (non renseignés)
        // fraisEssenceCentimes : 0 par défaut
        // budgetEstimatifCentimes : null
        // statut : PROSPECT par défaut (aucun Poste)
      },
    })
    lieuxCrees.push({ lieu, client: l.client })
  }

  console.log('  ✓ 6 lieux réels créés (statut PROSPECT, chef Rachid)')

  // -------------------------------------------------------------------
  // RÉCAP FINAL
  // -------------------------------------------------------------------
  console.log('\n✅ Seed de production terminé.')
  console.log('\nComptes de connexion :')
  console.log('  yassine.bruneau@gmail.com / admin123  (Yassine, admin)')
  console.log('  dbruneau77@gmail.com      / chef123   (Dominique, admin)')
  console.log('  rachid_aqoudi@hotmail.fr  / chef123   (Rachid Aqoudi, chef)')
  console.log('\nLieux créés (statut PROSPECT, à compléter via l\'app) :')
  for (const { lieu, client } of lieuxCrees) {
    console.log(`  ${lieu.reference} — ${lieu.nom}  (client : ${client.prenom} ${client.nom})`)
  }
  console.log('\nAucun Poste / Paiement / Dépense / Budget créé : à saisir via l\'app.')
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
