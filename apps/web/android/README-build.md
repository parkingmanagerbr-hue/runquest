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

## Produção
O `assembleDebug` gera um APK **debug** (assinado com a chave de debug). Para
distribuição séria, gere um **release assinado** com um keystore próprio
(`./gradlew assembleRelease` + config de `signingConfigs`) — o keystore e suas
senhas **nunca** vão para o repositório.
