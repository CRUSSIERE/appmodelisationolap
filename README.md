# Modélisation OLAP en étoile

Éditeur web 100 % client pour construire, éditer et exporter des schémas OLAP
en étoile et en constellation, selon le formalisme conceptuel multidimensionnel
de F. Ravat (faits, dimensions, hiérarchies multiples, paramètres, attributs
faibles). Aucun backend, aucun compte : tout se passe dans le navigateur.

**Essayer en ligne :** https://crussiere.github.io/appmodelisationolap/

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvre ensuite l'URL affichée par Vite (http://localhost:5173 par défaut).

Autres commandes :

```bash
npm run build             # build de production (tsc + vite build)
npm run lint              # oxlint
npm run verify:roundtrip  # le JSON exporté reconstruit le schéma à l'identique
npm run verify:hierarchy  # règles de création/extension/branchement des hiérarchies
```

## Utilisation

### Sur le canvas

- **Clic** sur un élément : le sélectionne. **Maj/Ctrl + clic** ajoute ou
  retire de la sélection ; **cliquer-glisser sur le fond** trace un rectangle
  de sélection multiple.
- **Clic droit** sur n'importe quel élément — dimension, fait, mesure,
  paramètre, attribut faible, chip de hiérarchie, trait de hiérarchie —
  ouvre le menu de ses actions (renommer, dupliquer, copier le nom,
  supprimer, plus les actions propres à l'élément).
- **Double-clic** sur un nom : le renomme en place.
- **Glisser-déposer** : dimensions et faits se déplacent librement ; les
  paramètres, attributs faibles et chips de hiérarchie peuvent aussi être
  repositionnés à la main dans leur dimension (sinon ils suivent le calcul
  de disposition automatique).

### Construire une hiérarchie

Le menu d'un **paramètre** porte la logique de hiérarchie :

- sur la clé : *Ajouter une hiérarchie*, puis *Ajouter une hiérarchie
  alternative* pour les suivantes ;
- sur un autre paramètre : *Créer une hiérarchie depuis ici*, qui fait
  bifurquer une branche ;
- *Ajouter un niveau au-dessus* pour prolonger, ou *Lier « X » au-dessus*
  pour faire converger deux hiérarchies sur un niveau déjà existant.

Le menu d'une **dimension** règle l'orientation de ses hiérarchies :
vers la **droite** (défaut), la **gauche**, le **haut** ou le **bas**.
Le réglage vaut pour toute la dimension, pas par hiérarchie : des
hiérarchies alternatives partagent les paramètres de leur tronc commun,
qui ne peuvent occuper qu'une seule position.

### Cardinalités

Le menu d'un **trait** de hiérarchie fixe le type de roll-up, repris de
l'éditeur de référence GraphicOLAP :

| Type | Cardinalités |
|---|---|
| Stricte | `1,n → 1,1` |
| Non stricte | `1,n → 1,n` |
| Stricte incomplète | `0,n → 0,1` |
| Non stricte incomplète | `0,n → 0,n` |
| Aucune | masqué |

La strictesse et la complétude sont des propriétés du lien entier, ce qui
explique l'absence de paires mixtes comme `1,n → 0,1`. La case *Afficher les
cardinalités* du panneau masque toutes les étiquettes d'un coup, sans
toucher aux types des liens.

### Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl+Z` / `Ctrl+Maj+Z` / `Ctrl+Y` | Annuler / Rétablir |
| `Ctrl+D` | Dupliquer la sélection |
| `Suppr` / `Retour arrière` | Supprimer la sélection |
| `Ctrl+B` | Afficher/masquer le panneau latéral |

Un glissement complet ou une session de frappe comptent pour **une seule**
étape d'annulation.

### Panneau latéral (à gauche)

Repliable section par section (*Tout replier* / *Tout déplier*), masquable
entièrement. Il contient :

- **Dossier** — ouvre un dossier du disque et liste ses fichiers `.json` ;
  un clic ouvre le schéma dans un nouvel onglet. Lecture seule : la
  sauvegarde reste un téléchargement.
- **Affichage** — police, taille et couleur du texte du diagramme, et
  l'interrupteur des cardinalités.
- **Avertissements** — validation permissive (voir plus bas).
- **Faits** et **Dimensions** — édition arborescente : renommage, types de
  données, ajout de mesures, d'attributs, de hiérarchies, connexion des
  dimensions à chaque fait.

Sélectionner un élément sur le canvas déplie et met le focus sur son champ
dans le panneau, et réciproquement. Le panneau complète l'édition sur le
canvas, il n'en est jamais le seul moyen.

### Plusieurs schémas à la fois

Une barre d'onglets permet d'ouvrir plusieurs schémas en parallèle. Chaque
onglet garde son propre historique d'annulation, sa sélection et sa position
de défilement.

## Validation

Permissive : les avertissements s'affichent dans le panneau mais ne bloquent
jamais l'édition.

- dimension sans paramètre identifiant (clé) ;
- hiérarchie qui ne démarre pas par la clé de sa dimension ;
- dimension sans aucun attribut ni hiérarchie.

Quelques règles sont en revanche appliquées à la construction : une
hiérarchie exige au moins deux paramètres, la clé n'est supprimable que
lorsqu'elle est le dernier paramètre, la suppression d'un paramètre le
retire de toutes les hiérarchies qui l'utilisent, et une hiérarchie devenue
strictement redondante avec une sœur est élaguée.

## Sauvegarde / import (JSON)

**Enregistrer (JSON)** télécharge le schéma courant ; **Importer (JSON)** le
recharge à l'identique, positions comprises. Ce JSON est le format de travail
(ré-édition) — pour partager ou documenter un résultat, l'export image est un
flux séparé. Les fichiers d'une version antérieure du format restent
chargeables : les champs ajoutés depuis sont complétés à l'import, et les
anciens exports à fait unique sont migrés vers la constellation.

### Structure du JSON

```ts
interface Schema {
  version: 2
  facts: {
    id: string
    name: string
    position: { x: number; y: number }
    measures: { id: string; name: string; dataType?: AttributeDataType }[]
    dimensionIds: string[]        // dimensions reliées à CE fait
  }[]
  dimensions: {
    id: string
    name: string
    position: { x: number; y: number }
    keyParameterId: string        // le paramètre identifiant (la clé)
    orientation?: 'right' | 'left' | 'up' | 'down'   // absent = 'right'
    parameters: {
      id: string
      name: string
      dataType?: AttributeDataType
      position?: { x: number; y: number }   // surcharge manuelle
      weakAttributes: {
        id: string
        name: string
        dataType?: AttributeDataType
        position?: { x: number; y: number }
      }[]
    }[]
    hierarchies: {
      id: string
      name: string
      path: string[]              // ids de paramètres, du plus fin (path[0] =
                                  // la clé) au plus général
      linkTypes?: Record<string, HierarchyLinkType>  // clé "fromId->toId",
                                                     // absent = 'strict'
      chipPosition?: { x: number; y: number }
    }[]
  }[]
  textStyle?: { fontFamily: string; fontSize: number; color: string }
  showCardinalities?: boolean     // absent = true
}

type AttributeDataType =
  | 'undefined' | 'text' | 'integer' | 'scientific'
  | 'decimal' | 'date' | 'binary'

type HierarchyLinkType =
  | 'strict' | 'non_strict'
  | 'strict_incomplete' | 'non_strict_incomplete' | 'none'
```

Points clés du modèle :

- Les attributs de base d'une dimension (au sens de Ravat) sont simplement
  les `weakAttributes` du `Parameter` dont l'id est `keyParameterId` — il
  n'existe pas de liste séparée, pour éviter toute divergence entre l'un et
  l'autre.
- `parameters` est le pool de nœuds de la dimension. Plusieurs hiérarchies
  peuvent partager les mêmes ids en début de chemin (la clé, voire
  davantage) puis diverger, ou converger à nouveau plus haut : c'est ce qui
  matérialise les hiérarchies alternatives.
- Un attribut faible est toujours rattaché à un paramètre précis, jamais à
  la dimension ou à la hiérarchie dans son ensemble.
- Un schéma peut contenir plusieurs faits (constellation), chacun relié à
  son propre sous-ensemble de dimensions via `dimensionIds`.
- Les champs `position` des paramètres, attributs faibles et chips sont des
  surcharges facultatives : absents, la disposition est recalculée
  automatiquement à partir de la profondeur dans la hiérarchie et de
  l'orientation de la dimension.

## Export image

Trois formats depuis la barre d'outils : **SVG** (vectoriel fidèle), **PNG**
et **JPG** (raster, générés à x2 pour la netteté). Le JPG a un fond blanc
opaque ; le PNG conserve la transparence.

## Stack technique

React + Vite + TypeScript + Tailwind CSS v4. Rendu du schéma en SVG écrit à
la main, sans librairie de diagramme. Aucun backend : la persistance passe
uniquement par l'export/import du fichier JSON. Déployé sur GitHub Pages à
chaque push sur `master`.

## Licence

[MIT](LICENSE) — libre d'utilisation, de modification et de redistribution,
y compris commerciale, à condition de conserver la mention de copyright.

Le formalisme multidimensionnel implémenté est celui de F. Ravat, O. Teste et
G. Zurfluh ; les règles métier (types de liens, types de données, contraintes
de construction) reprennent celles de l'éditeur de référence GraphicOLAP.
Ce dépôt en est une réimplémentation indépendante en TypeScript, sans code
repris de l'original.
