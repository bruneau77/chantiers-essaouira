# Devis de référence — Villa Pierre-Yves & Laurent

Cas test issu du fichier Excel original `VILLA_PY_ET_LAURENT.ods` fourni par
Yassine. **Ce devis sert de référence pour valider que tout nouveau code de
devis produit les bons calculs.**

## Contexte

- **Chantier** : Villa Pierre-Yves & Laurent, Essaouira
- **Travaux** : Réfection toiture-terrasse 300 m²
- **Durée prévue** : 20 jours
- **Date** : 2026-001 (premier chantier de l'année 2026)

## Structure du devis original (Excel)

Le devis original a 6 colonnes :

| DESCRIPTION | UNITÉ (= prix unitaire DH) | QUANTITÉ | M² | COÛT HT | OBSERVATION |

Note : "UNITÉ" dans le fichier Excel veut dire **prix unitaire en DH**, pas
"unité de mesure". Confusion à corriger dans l'app : on utilisera
`prixUnitaireBrutCentimes` et `typeMesure` (m² / quantité / forfait).

## Sections du devis

### MAIN D'ŒUVRE (sous-total ~54 175 DH)

| Description | PU (DH) | Qté/M² | Coût HT | Observation |
|---|---:|---:|---:|---|
| Retrait carrelage ancien | 30 | 300 m² | 9 000 | Évacuation incluse |
| Égalisation surfaces | 20 | 300 m² | 6 000 | |
| Pose carrelage neuf | 60 | 300 m² | 18 000 | Pose alignée |
| Joints | 15 | 300 m² | 4 500 | |
| Étanchéité raccords | 8 000 | 1 forfait | 8 000 | Hors trémie cheminée |

### MATÉRIEL (sous-total ~75 740 DH)

| Description | PU (DH) | Qté | Coût HT | Observation |
|---|---:|---:|---:|---|
| Camions sable | 1 400 | 3 | 4 200 | |
| Ciment 45 | 83 | 60 sacs | 4 980 | |
| Carrelage neuf | 145 | 310 m² | 44 950 | +10 m² pertes |
| Mortier-colle | 95 | 45 sacs | 4 275 | |
| Joint ciment blanc | 65 | 12 | 780 | |
| Verres toiture | 35 | 5 | 175 | Remplacement |

### TOTAL HT brut (interne) : ~129 915 DH

> Remarque : les chiffres exacts seront produits par le seed Prisma.
> Les valeurs ci-dessus sont indicatives — il peut y avoir un léger écart
> selon les arrondis. **C'est le seed qui fait foi**, pas ce document.

## Calculs avec marge 15% (logique app)

Quand on applique une marge globale de 15% par ligne :

- **Total BRUT** (ce que paie Dominique aux fournisseurs/ouvriers) :
  ~129 915 DH
- **Total CLIENT** (avec marge 15% appliquée à chaque ligne) :
  ~149 402 DH
- **Marge totale Dominique** : ~19 487 DH

## Échéancier 30/40/30

À partir du total client 149 402 DH :

- **Acompte (30%)** à la signature : 44 821 DH
- **Mi-chantier (40%)** : 59 761 DH
- **Solde (30%)** à la livraison : 44 820 DH

(Le solde absorbe le centime d'arrondi pour que la somme exacte = total.)

## Frais essence

Hypothèse : domicile Dominique → Villa PY = 8 km, 12 A/R prévus.

Avec les réglages par défaut :
- Coût gasoil : 9.5 × 11.50 / 100 = 1.0925 DH/km
- Usure : 0.80 DH/km
- **Coût km : ~1.89 DH**
- A/R total : 12 + 1 sécurité = 13
- Distance totale : 8 × 2 × 13 = 208 km
- **Frais essence : ~393 DH**

## Marge nette de Dominique sur ce chantier

```
Marge brute        : +19 487 DH
- Frais essence    :    -393 DH
= Marge nette      : ~19 094 DH
```

À partager avec Rachid selon la règle de partage (50/50 par défaut, base
DEVIS) :

- Commission sur DEVIS 15% × 149 402 = ~22 410 DH (à partager)
- Part Dominique 50% : ~11 205 DH
- Part Rachid 50% : ~11 205 DH

Note : ces chiffres dépendent de la configuration (base commission
DEVIS vs MARGE). Voir `backend/src/services/compta.js` pour la formule
définitive (à implémenter).

## Validation

Quand tu lances `npx prisma db seed`, tu dois voir s'afficher des chiffres
proches de ceux ci-dessus. **Tout écart significatif (> 1%) signale un
bug dans `lib/calculsDevis.js` ou `lib/fraisKm.js`.**
