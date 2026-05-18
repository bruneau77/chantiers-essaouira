/**
 * Seed Prisma — données de démonstration
 *
 * Crée :
 *  - 3 utilisateurs (Yassine admin, Dominique chef, Rachid sous-traitant)
 *  - 1 client de démo
 *  - Réglages par défaut
 *  - Le devis de référence Villa Pierre-Yves & Laurent (cas réel)
 *  - Quelques matériaux courants (ciment, sable, etc.)
 *  - Un fournisseur de démo
 *
 * Lancement : `npx prisma db seed`
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { calculerLigneDevis, calculerTotauxDevis, calculerEcheancier } from '../src/lib/calculsDevis.js'
import { calculerFraisEssence } from '../src/lib/fraisKm.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Démarrage du seed...')

  // -----------------------------------------------------------------
  // RÉGLAGES PAR DÉFAUT
  // -----------------------------------------------------------------
  const reglages = await prisma.reglages.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })
  console.log('  ✓ Réglages par défaut')

  // -----------------------------------------------------------------
  // UTILISATEURS
  // -----------------------------------------------------------------
  const motDePasseAdmin = await bcrypt.hash('admin123', 12)
  const motDePasseChef = await bcrypt.hash('chef123', 12)

  const yassine = await prisma.utilisateur.upsert({
    where: { email: 'yassine.bruneau@gmail.com' },
    update: { role: 'admin' },
    create: {
      email: 'yassine.bruneau@gmail.com',
      motDePasseHash: motDePasseAdmin,
      prenom: 'Yassine',
      nom: 'Bruneau',
      telephone: '+33 6 42 24 76 54',
      role: 'admin',
    },
  })

  const dominique = await prisma.utilisateur.upsert({
    where: { email: 'dbruneau77@gmail.com' },
    update: { role: 'admin' },
    create: {
      email: 'dbruneau77@gmail.com',
      motDePasseHash: motDePasseChef,
      prenom: 'Dominique',
      nom: 'Bruneau',
      telephone: '+212 6 87 19 86 36',
      role: 'admin',
      partDefautPct: 50,
    },
  })

  // Rachid : email placeholder en attendant le vrai. À remplacer
  // quand Rachid aura communiqué son adresse mail.
  // Nom 'El Mansouri' mis dans `update` ET `create` pour que le re-seed
  // sans reset DB corrige aussi les enregistrements existants qui avaient
  // le placeholder '(à compléter)'.
  const rachid = await prisma.utilisateur.upsert({
    where: { email: 'rachid@ludimmo.ma' },
    update: { role: 'chef', nom: 'El Mansouri' },
    create: {
      email: 'rachid@ludimmo.ma',
      motDePasseHash: motDePasseChef,
      prenom: 'Rachid',
      nom: 'El Mansouri',
      role: 'chef',
      partDefautPct: 50,
    },
  })

  const clientDemo = await prisma.utilisateur.upsert({
    where: { email: 'pierre-yves@example.com' },
    update: {},
    create: {
      email: 'pierre-yves@example.com',
      motDePasseHash: await bcrypt.hash('demo123', 12),
      prenom: 'Pierre-Yves',
      nom: 'Laurent',
      role: 'client',
    },
  })

  console.log('  ✓ 4 utilisateurs créés (2 admin / 1 chef / 1 client)')

  // -----------------------------------------------------------------
  // FOURNISSEUR + MATÉRIAUX DE BASE
  // -----------------------------------------------------------------
  const fournisseurDemo = await prisma.fournisseur.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nom: 'Fournisseur local Essaouira',
      contact: 'À compléter',
      telephone: '+212 5 ...',
    },
  })

  const materiauxBase = [
    { nom: 'Ciment 45', categorie: 'ciment_sable_chaux', uniteMesure: 'sac', prixCentimes: 8300 },
    { nom: 'Sable (camion)', categorie: 'ciment_sable_chaux', uniteMesure: 'camion', prixCentimes: 140000 },
    { nom: 'Chaux', categorie: 'ciment_sable_chaux', uniteMesure: 'sac', prixCentimes: 6500 },
    { nom: 'Verre toiture standard', categorie: 'divers', uniteMesure: 'pièce', prixCentimes: 3500 },
  ]

  for (const mat of materiauxBase) {
    await prisma.materiau.upsert({
      where: { id: materiauxBase.indexOf(mat) + 1 },
      update: {},
      create: {
        id: materiauxBase.indexOf(mat) + 1,
        nom: mat.nom,
        categorie: mat.categorie,
        uniteMesure: mat.uniteMesure,
        prixActuelCentimes: mat.prixCentimes,
        fournisseurId: 1,
      },
    })
  }
  console.log(`  ✓ ${materiauxBase.length} matériaux de base créés`)

  // -----------------------------------------------------------------
  // CHANTIER DE RÉFÉRENCE : Villa Pierre-Yves & Laurent
  // -----------------------------------------------------------------
  // NOTE 2026-05-16 : `chefId` pointe désormais vers Rachid (chef de
  // chantier terrain), conformément au cahier des charges Compta. Dominique
  // reste admin/gérant commercial mais n'apparaît plus comme chef. On laisse
  // `sousTraitantId` à null : Rachid n'est plus à la fois chef ET sous-traitant.
  const chantierVillaPY = await prisma.chantier.upsert({
    where: { numero: '2026-001' },
    update: {
      chefId: rachid.id,
      sousTraitantId: null,
    },
    create: {
      numero: '2026-001',
      titre: 'Villa Pierre-Yves & Laurent',
      description: 'Réfection toiture 300 m² — terrasse principale',
      adresseChantier: 'Essaouira (à compléter)',
      chefId: rachid.id,
      clientId: clientDemo.id,
      sousTraitantId: null,
      statut: 'en_cours',
      distanceAllerKm: 8,
      nombreAllerRetourPrevu: 12,
    },
  })

  // Frais essence calculés selon la formule métier
  const fraisEssenceCentimes = calculerFraisEssence({
    distanceAllerKm: 8,
    nombreAllerRetourPrevu: 12,
    reglages,
  })
  await prisma.chantier.update({
    where: { id: chantierVillaPY.id },
    data: { fraisEssenceCentimes },
  })
  console.log(`  ✓ Chantier Villa PY créé (frais essence ${fraisEssenceCentimes / 100} DH)`)

  // -----------------------------------------------------------------
  // DEVIS DE RÉFÉRENCE — reproduit fidèlement le devis Excel original
  // -----------------------------------------------------------------
  // Lignes brutes correspondant au fichier VILLA_PY_ET_LAURENT.ods
  // Marge 15% par défaut sur tout (à ajuster ligne par ligne plus tard)
  //
  // TODO [vérif différée 2026-05-12] : ces 11 lignes produisent un total
  // brut de 104 860 DH, alors que docs/devis_reference.md annonce ~129 915 DH.
  // Écart de ~25 000 DH = des lignes manquantes (probablement). À
  // rapprocher avec le fichier Excel d'origine quand il sera disponible.
  // La LOGIQUE de calcul est validée — seules les données peuvent être
  // incomplètes.
  const lignesBrutes = [
    // MAIN D'ŒUVRE
    { section: 'main_oeuvre', description: 'Retrait du carrelage ancien', typeMesure: 'surface_m2', quantite: 300, prixUnitaireBrutDh: 30, observation: 'Évacuation incluse' },
    { section: 'main_oeuvre', description: 'Égalisation des surfaces', typeMesure: 'surface_m2', quantite: 300, prixUnitaireBrutDh: 20, observation: '' },
    { section: 'main_oeuvre', description: 'Pose carrelage neuf', typeMesure: 'surface_m2', quantite: 300, prixUnitaireBrutDh: 60, observation: 'Pose alignée à la ligne' },
    { section: 'main_oeuvre', description: 'Joints', typeMesure: 'surface_m2', quantite: 300, prixUnitaireBrutDh: 15, observation: '' },
    { section: 'main_oeuvre', description: 'Étanchéité raccords', typeMesure: 'forfait', quantite: 1, prixUnitaireBrutDh: 8000, observation: 'Hors trémie cheminée (en attente)' },
    // MATÉRIEL
    { section: 'materiel', description: 'Camions de sable', typeMesure: 'quantite', quantite: 3, prixUnitaireBrutDh: 1400, observation: '' },
    { section: 'materiel', description: 'Ciment 45', typeMesure: 'quantite', quantite: 60, prixUnitaireBrutDh: 83, observation: 'Sacs 50 kg' },
    { section: 'materiel', description: 'Carrelage neuf', typeMesure: 'surface_m2', quantite: 310, prixUnitaireBrutDh: 145, observation: 'Sur-quantité 10 m² pour pertes' },
    { section: 'materiel', description: 'Mortier-colle', typeMesure: 'quantite', quantite: 45, prixUnitaireBrutDh: 95, observation: 'Sacs' },
    { section: 'materiel', description: 'Joint ciment blanc', typeMesure: 'quantite', quantite: 12, prixUnitaireBrutDh: 65, observation: '' },
    { section: 'materiel', description: 'Verres de toiture', typeMesure: 'quantite', quantite: 5, prixUnitaireBrutDh: 35, observation: 'Remplacement casses' },
  ]

  // Numéro devis
  const devisRef = await prisma.devis.upsert({
    where: { numero: 'DEV-2026-001' },
    update: {},
    create: {
      numero: 'DEV-2026-001',
      chantierId: chantierVillaPY.id,
      statut: 'accepte',
      tempsTravailJours: 20,
      observations: 'Tarifs valables 30 jours. Trémie cheminée non incluse (en attente devis séparé).',
    },
  })

  // Créer les lignes
  for (let i = 0; i < lignesBrutes.length; i++) {
    const l = lignesBrutes[i]
    const prixUnitaireBrutCentimes = l.prixUnitaireBrutDh * 100
    const margePct = 15
    const calculs = calculerLigneDevis({
      prixUnitaireBrutCentimes,
      quantite: l.quantite,
      margePct,
    })

    await prisma.ligneDevis.create({
      data: {
        devisId: devisRef.id,
        ordre: i + 1,
        section: l.section,
        description: l.description,
        observation: l.observation || null,
        typeMesure: l.typeMesure,
        quantite: l.quantite,
        prixUnitaireBrutCentimes,
        margePct,
        ...calculs,
      },
    })
  }

  // Mise à jour des totaux du devis
  const lignesCreees = await prisma.ligneDevis.findMany({ where: { devisId: devisRef.id } })
  const totaux = calculerTotauxDevis(lignesCreees)
  await prisma.devis.update({
    where: { id: devisRef.id },
    data: {
      totalBrutCentimes: totaux.totalBrutCentimes,
      totalClientCentimes: totaux.totalClientCentimes,
      margeMontantCentimes: totaux.margeMontantCentimes,
    },
  })

  console.log(`  ✓ Devis DEV-2026-001 créé`)
  console.log(`     • Total brut : ${totaux.totalBrutCentimes / 100} DH`)
  console.log(`     • Total client (marge 15%) : ${totaux.totalClientCentimes / 100} DH`)
  console.log(`     • Marge totale : ${totaux.margeMontantCentimes / 100} DH`)

  // Échéancier 30/40/30
  const echeancier = calculerEcheancier(totaux.totalClientCentimes, reglages)
  for (const p of echeancier) {
    await prisma.paiement.create({
      data: {
        chantierId: chantierVillaPY.id,
        type: p.type,
        pourcentage: p.pourcentage,
        montantCentimes: p.montantCentimes,
        statut: 'attendu',
      },
    })
  }
  console.log(`  ✓ Échéancier 30/40/30 créé (3 paiements)`)

  console.log('\n✅ Seed terminé.')
  console.log('\nComptes de connexion :')
  console.log('  yassine.bruneau@gmail.com / admin123  (Yassine, admin)')
  console.log('  dbruneau77@gmail.com      / chef123   (Dominique, admin)')
  console.log('  rachid@ludimmo.ma         / chef123   (Rachid, chef — email placeholder)')
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
