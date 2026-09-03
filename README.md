# Modélisation OLAP en étoile

Application web 100% cliente pour construire, éditer et exporter des schémas
OLAP en étoile selon le formalisme conceptuel multidimensionnel de F. Ravat
(fait, dimensions, hiérarchies multiples, paramètres, attributs faibles).

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvre ensuite l'URL affichée par Vite (http://localhost:5173 par défaut).

Autres commandes :

```bash
npm run build             # build de production (tsc + vite build)
npm run verify:roundtrip  # vérifie que le JSON exporté reconstruit le schéma à l'identique
```

## Utilisation

- **Clic sur une zone vide du canvas** : ajoute une nouvelle dimension.
- **Clic sur un paramètre** (cercle) : ouvre un menu pour ajouter un
  attribut faible, ajouter un niveau au-dessus dans la hiérarchie, ou (sur
  la clé) ajouter une hiérarchie alternative.
- **Double-clic** sur un nom (dimension, fait, mesure, paramètre, attribut
  faible, hiérarchie) : renomme l'élément en place.
- **Glisser-déposer** une dimension : la déplace ; les connexions vers le
  fait et les niveaux suivent automatiquement.
- **× / × supprimer** : supprime l'élément concerné directement sur le
  canvas.
- Le panneau latéral (à droite) permet de renommer le fait, les mesures et
  les dimensions, et affiche les avertissements de validation — il complète
  l'édition mais n'est jamais le seul moyen d'agir.

La validation est permissive : les avertissements (dimension sans clé,
hiérarchie qui ne démarre pas par la clé, dimension sans attribut ni
hiérarchie) s'affichent dans le panneau latéral mais ne bloquent jamais
l'édition.

## Sauvegarde / import (JSON)

Le bouton **Enregistrer (JSON)** télécharge le schéma courant ; **Importer
(JSON)** recharge un fichier précédemment exporté et reconstruit le schéma
à l'identique, positions des dimensions comprises. Ce JSON est le format de
travail (ré-édition) — pour partager ou documenter le résultat, utilisez
l'export image (SVG / PNG / JPG) qui est un flux séparé.

### Structure du JSON

```ts
interface Schema {
  version: 1
  fact: {
    id: string
    name: string
    measures: { id: string; name: string }[]
  }
  dimensions: {
    id: string
    name: string
    position: { x: number; y: number }   // position de la dimension sur le canvas
    keyParameterId: string               // id du paramètre identifiant (la clé)
    parameters: {
      id: string
      name: string
      weakAttributes: { id: string; name: string }[] // dont les attributs de
                                                       // base, sur le paramètre clé
    }[]
    hierarchies: {
      id: string
      name: string
      path: string[]  // ids de paramètres, ordonnés du plus fin (path[0] =
                       // la clé) au plus général
    }[]
  }[]
}
```

Points clés du modèle :

- Les attributs de base d'une dimension (au sens de Ravat) sont simplement
  les `weakAttributes` du `Parameter` dont l'id est `keyParameterId` — il
  n'existe pas de liste séparée, pour éviter toute divergence entre l'un et
  l'autre.
- `parameters` est le pool de nœuds de la dimension. Plusieurs hiérarchies
  peuvent partager les mêmes ids de paramètres en début de chemin (la clé,
  voire davantage) puis diverger : c'est ce qui matérialise des hiérarchies
  alternatives bifurquant depuis un même axe.
- Un attribut faible est toujours rattaché à un paramètre précis
  (`parameters[i].weakAttributes`), jamais à la dimension ou à la hiérarchie
  dans son ensemble.
- Le lien fait-dimension n'est pas stocké explicitement : il est toujours
  "la clé de chaque dimension", conformément au modèle.

## Export image

Trois formats disponibles depuis la barre d'outils : **SVG** (vectoriel
fidèle), **PNG** et **JPG** (raster, générés à x2 pour la netteté). Le JPG a
un fond blanc opaque (pas de transparence) ; le PNG conserve la
transparence.

## Stack technique

React + Vite + TypeScript + Tailwind CSS v4. Rendu du schéma en SVG écrit à
la main (aucune librairie de diagramme). Aucun backend : la persistance
passe uniquement par l'export/import du fichier JSON.

## Licence

[MIT](LICENSE) — libre d'utilisation, de modification et de redistribution,
y compris commerciale, à condition de conserver la mention de copyright.
