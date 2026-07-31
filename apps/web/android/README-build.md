# Build do APK Android (RunQuest)

O app nativo é uma casca Capacitor que carrega o web app (`server.url` em
`capacitor.config.ts`). O APK só precisa ser regerado quando muda algo **nativo**
(plugins, permissões, ícones) — não a cada deploy da web.

## Pré-requisitos
- **JDK 17+** (testado com 21).
- **Android SDK** com a **plataforma android-35** e **build-tools 35**.
  Crie `android/local.properties` (ignorado no git) apontando o SDK:
  ```
  sdk.dir=C:/Users/<voce>/AppData/Local/Android/Sdk
  ```
- Alinhado ao **Capacitor 7**: AGP 8.7.2, Gradle 8.11.1 (wrapper), Kotlin 1.9.25,
  compileSdk/targetSdk 35, minSdk 23.

## Passos
```bash
cd apps/web
npx cap sync android          # copia web assets + regenera a ponte dos plugins
cd android
./gradlew assembleDebug       # gera app/build/outputs/apk/debug/app-debug.apk
```
Depois, publique o APK no site:
```bash
cp app/build/outputs/apk/debug/app-debug.apk ../public/downloads/runquest.apk
```
O site já serve `/downloads/runquest.apk` (botão "Baixar APK" na landing).

## Rede corporativa (MITM de TLS)
Se o Gradle/AGP falhar o download com `PKIX path building failed`, faça o Java
confiar na loja de certificados do Windows (que tem o CA corporativo). **Não**
comite isto no projeto — coloque no `~/.gradle/gradle.properties` (global):
```
systemProp.javax.net.ssl.trustStoreType=Windows-ROOT
```

## Produção (release assinado)
O `app/build.gradle` tem um `signingConfigs.release` que lê as credenciais do
`~/.gradle/gradle.properties` **da máquina** (nunca do repositório):
```
RUNQUEST_STORE_FILE=C:/Users/<voce>/.android-keys/runquest-release.keystore
RUNQUEST_STORE_PASSWORD=...
RUNQUEST_KEY_ALIAS=runquest
RUNQUEST_KEY_PASSWORD=...
```
Com elas presentes:
```bash
./gradlew assembleRelease   # gera app/build/outputs/apk/release/app-release.apk (assinado)
cp app/build/outputs/apk/release/app-release.apk ../public/downloads/runquest.apk
```
Sem as propriedades, o release cai na assinatura de debug (CI-safe).

**FAÇA BACKUP do keystore e das senhas.** Perder o keystore = impossível publicar
atualização com a mesma assinatura (o Android bloqueia instalar por cima).
Atualizações futuras devem também incrementar `versionCode`/`versionName` no
`app/build.gradle`.
