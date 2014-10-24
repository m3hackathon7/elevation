# Route7

![アイコン](icon.png)

Ionic を使った Cordova アプリです。ルート検索結果の周囲の地形を見ることができます。

2014 年 10 月 の M3 Hackathon で開発しました。

[資料はこちら](https://github.com/m3hackathon7/m3hackathon7/wiki)

![ルート検索](screenshot-search.png)

![検索結果](screenshot-result.png)

![3D 地形表示](screenshot-terrain.png)

## Setup

Install tools.

```
npm install -g cordova
npm install -g ionic
npm install -g ios-sim
```

Install dependencies.

```
npm install
bower install
```

Add platform.

```
ionic platform add ios
```

Add plugins.

```
ionic plugin add com.ionic.keyboard
ionic plugin add org.apache.cordova.device
ionic plugin add org.apache.cordova.console
ionic plugin add org.apache.cordova.geolocation
```

## Development

Preview in browser with livereload.

```
ionic serve
```

Test in emulator.

```
# List available emulators.
./platforms/ios/cordova/lib/list-emulator-images

ionic build ios
ionic emulate ios --target="iPhone (Retina 4-inch)"
```

Test in device.

```
ionic run ios
```
