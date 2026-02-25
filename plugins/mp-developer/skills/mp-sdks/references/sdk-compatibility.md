# SDK Compatibility Matrix

## SDK-to-Feature Support

| SDK | Tokenization | Bricks UI | Checkout Pro redirect | Payment creation | Subscriptions | Refunds |
|-----|---|---|---|---|---|---|
| Node.js | via server | - | create preference | yes | yes | yes |
| Python | via server | - | create preference | yes | yes | yes |
| Java | via server | - | create preference | yes | yes | yes |
| PHP | via server | - | create preference | yes | yes | yes |
| Ruby | via server | - | create preference | yes | yes | yes |
| .NET | via server | - | create preference | yes | yes | yes |
| Go | via server | - | create preference | yes | check repo | check repo |
| MercadoPago.js | yes (client) | yes | - | - | - | - |
| React SDK | yes (client) | yes | - | - | - | - |
| iOS SDK | yes (client) | no | - | - | - | - |
| Android SDK | yes (client) | no | - | - | - | - |

## GitHub Repositories

| SDK | Repository |
|-----|-----------|
| Node.js | `github.com/mercadopago/sdk-nodejs` |
| Python | `github.com/mercadopago/sdk-python` |
| Java | `github.com/mercadopago/sdk-java` |
| PHP | `github.com/mercadopago/dx-php` |
| Ruby | `github.com/mercadopago/sdk-ruby` |
| .NET | `github.com/mercadopago/sdk-dotnet` |
| Go | `github.com/mercadopago/sdk-go` |
| MercadoPago.js | CDN only — `sdk.mercadopago.com/js/v2` |
| React SDK | `github.com/mercadopago/sdk-react` |
| iOS | `github.com/mercadopago/sdk-ios` |
| Android | `github.com/mercadopago/sdk-android` |

## Minimum Version Requirements

| SDK | Minimum runtime |
|-----|----------------|
| Node.js | Node 12+ |
| Python | Python 3.x |
| Java | Java 8+ |
| PHP | PHP 7.2+ |
| Ruby | Ruby 2.3+ |
| .NET | .NET Standard 2.0+ |
| Go | Go 1.18+ |
| React SDK | React 16.8+ (hooks) |
| iOS | Check repo for current min iOS version |
| Android | Check repo for current min API level |

> **Note**: Exact version numbers change over time. Always check the GitHub repository for the most current requirements.
