# Banca+ - status Firebase

Projeto: `bancamais-12778`.

## Criado

- [x] Firebase project.
- [x] Firestore.
- [x] Storage bucket: `gs://bancamais-12778.firebasestorage.app`.
- [x] Hosting configurado no repositorio.
- [x] Firestore rules no repositorio.
- [x] Storage rules no repositorio.

## Usado no app

- Auth anonimo.
- Auth email/senha.
- Firestore para snapshot do estado do usuario.
- Storage para prints de bilhete em `users/{uid}/bet-slips/*`.

## Pendente no console Firebase

- [ ] Confirmar Email/Password habilitado em Authentication.
- [ ] Confirmar Anonymous habilitado se o modo demo cloud continuar ativo.
- [x] Publicar `firestore.rules` — feito via `firebase deploy --only firestore:rules`.
- [x] Publicar `storage.rules` — feito via `firebase deploy --only storage`.
- [ ] Ativar App Check antes de producao.
