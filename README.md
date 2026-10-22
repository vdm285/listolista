# Papelito se mudó · Papelito moved

**https://vdm285.github.io/papelito/** · código / code: https://github.com/vdm285/papelito

Este repositorio solo reenvía la dirección vieja, vdm285.github.io/listolista, a la nueva, con el enlace de la lista intacto. Las listas viven en cada teléfono, no aquí.

This repository only forwards the old address, vdm285.github.io/listolista, to the new one, with the list's link intact. Lists live on each phone, not here.

- `index.html`, `404.html`: forward any old path to the new address, keeping `?lang=` and the `#k=` link.
- `sw.js`: replaces the old app's offline worker at this address, deletes its old copy and unregisters itself, so installed phones reach the forward.
