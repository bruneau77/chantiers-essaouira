/**
 * Calcul des frais kilométriques pour les déplacements chantier
 *
 * Formule métier (validée avec Dominique) :
 *   coutKm = (consommation_l_par_100km × prix_gasoil_dh_par_l) / 100
 *          + usure_dh_par_km
 *
 *   frais_essence = distance_aller_simple_km × 2 × (nb_aller_retour_prevus + securite_ar)
 *                 × coutKm
 *
 * Toutes les valeurs DH sont en CENTIMES dans la DB. Les calculs internes
 * utilisent des centimes pour éviter les erreurs d'arrondi flottants.
 */

/**
 * Calcule le coût d'un kilomètre parcouru, en centimes DH.
 *
 * @param {object} reglages
 * @param {number} reglages.consommationL100km - L/100km, ex 9.5
 * @param {number} reglages.prixGasoilCentimes - DH × 100, ex 1150 = 11.50 DH
 * @param {number} reglages.usureCentimesParKm - DH × 100, ex 80 = 0.80 DH
 * @returns {number} Coût d'un km en centimes DH (entier arrondi)
 */
export function calculerCoutKm({ consommationL100km, prixGasoilCentimes, usureCentimesParKm }) {
  // Coût gasoil pour 1 km en centimes :
  // (L/100km × prix_centimes/L) / 100 km = centimes / km
  const coutGasoilCentimesParKm = (consommationL100km * prixGasoilCentimes) / 100
  const coutTotal = coutGasoilCentimesParKm + usureCentimesParKm
  return Math.round(coutTotal)
}

/**
 * Calcule les frais d'essence totaux pour un chantier.
 *
 * @param {object} params
 * @param {number} params.distanceAllerKm - Distance maison → chantier (one-way)
 * @param {number} params.nombreAllerRetourPrevu - Nb de A/R prévus
 * @param {object} params.reglages - Voir calculerCoutKm + securiteAllerRetour
 * @returns {number} Frais essence totaux en centimes DH
 */
export function calculerFraisEssence({
  distanceAllerKm,
  nombreAllerRetourPrevu,
  reglages,
}) {
  const coutKmCentimes = calculerCoutKm(reglages)
  const nbARTotal = nombreAllerRetourPrevu + reglages.securiteAllerRetour
  const distanceTotaleKm = distanceAllerKm * 2 * nbARTotal
  return Math.round(distanceTotaleKm * coutKmCentimes)
}

/**
 * Détaille le calcul pour affichage/audit (utile dans l'UI).
 *
 * @returns {object} Détail des étapes du calcul
 */
export function detailFraisEssence({
  distanceAllerKm,
  nombreAllerRetourPrevu,
  reglages,
}) {
  const coutKmCentimes = calculerCoutKm(reglages)
  const nbARTotal = nombreAllerRetourPrevu + reglages.securiteAllerRetour
  const distanceTotaleKm = distanceAllerKm * 2 * nbARTotal
  const totalCentimes = distanceTotaleKm * coutKmCentimes

  return {
    coutKmCentimes,
    coutKmAffichage: (coutKmCentimes / 100).toFixed(2) + ' DH/km',
    nbARTotal,
    nbARDetail: `${nombreAllerRetourPrevu} prévus + ${reglages.securiteAllerRetour} sécurité`,
    distanceTotaleKm,
    distanceDetail: `${distanceAllerKm} km × 2 × ${nbARTotal} A/R = ${distanceTotaleKm} km`,
    totalCentimes: Math.round(totalCentimes),
    totalAffichage: formaterDh(Math.round(totalCentimes)),
  }
}

/**
 * Formate des centimes DH en chaîne lisible "129 915 DH".
 *
 * @param {number} centimes
 * @returns {string}
 */
export function formaterDh(centimes) {
  const dh = Math.round(centimes / 100)
  // Espace insécable comme séparateur de milliers (convention française)
  return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH'
}
