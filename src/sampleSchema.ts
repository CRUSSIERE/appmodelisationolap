import type { Schema } from './types'

export const sampleSchema: Schema = {
  version: 2,
  facts: [
    {
      id: 'fact-ventes',
      name: 'VENTES',
      position: { x: 480, y: 500 },
      measures: [{ id: 'm-montant', name: 'montant' }],
      dimensionIds: ['dim-produits', 'dim-temps', 'dim-clients'],
    },
  ],
  dimensions: [
    {
      id: 'dim-produits',
      name: 'PRODUITS',
      position: { x: 120, y: 120 },
      keyParameterId: 'p-codeP',
      parameters: [
        {
          id: 'p-codeP',
          name: 'codeP',
          weakAttributes: [
            { id: 'wa-prix_unit', name: 'prix_unit' },
            { id: 'wa-description', name: 'description' },
          ],
        },
        { id: 'p-sous_categ', name: 'sous_categ', weakAttributes: [] },
        { id: 'p-categorie', name: 'categorie', weakAttributes: [] },
      ],
      hierarchies: [
        {
          id: 'h-prod',
          name: 'H_PROD',
          path: ['p-codeP', 'p-sous_categ', 'p-categorie'],
        },
      ],
    },
    {
      id: 'dim-temps',
      name: 'TEMPS',
      position: { x: 520, y: 120 },
      keyParameterId: 'p-date',
      parameters: [
        { id: 'p-date', name: 'Date', weakAttributes: [] },
        {
          id: 'p-num_mois',
          name: 'num_mois',
          weakAttributes: [{ id: 'wa-lib_mois', name: 'lib_mois' }],
        },
        { id: 'p-annee', name: 'annee', weakAttributes: [] },
      ],
      hierarchies: [
        {
          id: 'h-an',
          name: 'H_AN',
          path: ['p-date', 'p-num_mois', 'p-annee'],
        },
      ],
    },
    {
      id: 'dim-clients',
      name: 'CLIENTS',
      position: { x: 920, y: 120 },
      keyParameterId: 'p-codeC',
      parameters: [
        {
          id: 'p-codeC',
          name: 'codeC',
          weakAttributes: [
            { id: 'wa-nom', name: 'nom' },
            { id: 'wa-prenom', name: 'prenom' },
          ],
        },
        { id: 'p-ville', name: 'ville', weakAttributes: [] },
        { id: 'p-depart', name: 'depart', weakAttributes: [] },
        { id: 'p-pays', name: 'pays', weakAttributes: [] },
      ],
      hierarchies: [
        {
          id: 'h-cli-fr',
          name: 'H_Fr',
          path: ['p-codeC', 'p-ville', 'p-depart', 'p-pays'],
        },
        {
          id: 'h-cli-non-fr',
          name: 'H_Non_Fr',
          path: ['p-codeC', 'p-ville', 'p-pays'],
        },
      ],
    },
  ],
}
