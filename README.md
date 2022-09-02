# Kubbent Lightning Wallet

<a href="https://play.google.com/apps/testing/com.kubbent">Download from PlaySore</a>&nbsp;

Kubbent Wallet is an open source Lightning Bitcoin Wallet for Android with focus on usability and user experience,
powered by lnd and Neutrino SPV.

## Todo

- [ ] Percentage and fee calculation

# THIS IS A FORK OF THE BLIXT WALLET
https://github.com/hsjoberg/blixt-wallet

### Android

- Install [Node](https://nodejs.org), [Yarn](https://classic.yarnpkg.com) and [Android Studio + Android SDK (including NDK)](https://developer.android.com/studio/)
- If needed, install an emulated android device inside Android Studio
- Download lnd binary from [from the latest Kubbent Wallet release](https://github.com/hsjoberg/kubbent-wallet/releases) and put it in `android/lndmobile`. Alternatively build lnd for Android by following the steps in [build-android-aar.md](build-android-aar.md)
- Get the tor sub-module: `git submodule update --init`
- Install Node packages: `yarn`
- Compile the Tor Android lib: `yarn build-tor-lib`
- Generate proto files: `yarn gen-proto`

To start the application:
- Run: `yarn start-metro`
- Run: `yarn android:mainnet-debug` or `yarn android:testnet-debug`

## License

MIT
