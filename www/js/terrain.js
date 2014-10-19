angular.module('elevation.terrain', [])

.controller('TerrainCtrl', function() {
  var self = this;
})

.directive('evTerrainViewer', function($cordovaGeolocation,
                                       $log,
                                       $window,
                                       TerrainViewer,
                                       MapImageService) {
  return {
    restrict: 'E',
    scope: {
      route: '='
    },
    link: function(scope, element, attrs) {
      element.css({
        width: '100%',
        height: '600px',
        display: 'block'
      });

      scope.$watch('route', function(newValue, oldValue) {
        if (!scope.route || !scope.route.legs) {
          return;
        }

        // TODO: Add some margin.
        var bounds = scope.route.bounds;
        var center = getCenter(bounds);
        var route = getRoute(scope.route);

        MapImageService.getMapImage(bounds)
          .then(function(imageData) {
            $log.debug('Got image data', imageData.width, imageData.height);

            var viewer = new TerrainViewer(element[0]);
            viewer.setTerrain(imageData.dataUrl, imageData.width, imageData.height);
            // TODO: Get elevation mesh.
            viewer.setCoordGrid([
              0, 0,
              0, 0
            ], 2, 2);
            viewer.setCenter(center.lat, center.lng);
            viewer.setRoute(route);
            viewer.setup();
          }, function(err) {
            $log.error(err);
          });
      });
    }
  };

  function getCenter(bounds) {
    var lat = (bounds.southwest.lat + bounds.northeast.lat) / 2;
    var lng = (bounds.southwest.lng + bounds.northeast.lng) / 2;
    return { lat: lat, lng: lng };
  }

  function getRoute(route) {
    var result = [];
    route.legs.forEach(function(leg, i, legs) {
      leg.steps.forEach(function(step, j, steps) {
        // TODO: Decode step.polyline.points.
        result.push({
          lat: step.start_location.lat,
          lon: step.start_location.lng,
          elev: 0
        });

        if (i === legs.length - 1 && j === steps.length - 1) {
          result.push({
            lat: step.end_location.lat,
            lon: step.end_location.lng,
            elev: 0
          });
        }
      });
    });
    return result;
  }
})

.factory('MapImageService', function($log,
                                     $q,
                                     $document,
                                     TileService) {
  return {
    getMapImage: getMapImage
  };

  /**
   * Creates map image of the given bounds.
   * @param {Object} bounds - an object that has `southwest` and `northwest`.
   * @returns {Promise} promise of created image's data
   * The data consists of width, height and dataUrl.
   */
  function getMapImage(bounds) {
    var deferred = $q.defer();

    var zoomLevel = 15;

    // Pixel size.
    // TODO: Pixel coordinates should be integers.
    var southwestPosition = TileService.getPixelCoordinates(bounds.southwest.lat, bounds.southwest.lng, zoomLevel);
    var northeastPosition = TileService.getPixelCoordinates(bounds.northeast.lat, bounds.northeast.lng, zoomLevel);
    var offsetX = southwestPosition.x % 256;
    var offsetY = northeastPosition.y % 256;
    var pixelWidth = northeastPosition.x - southwestPosition.x;
    var pixelHeight = southwestPosition.y - northeastPosition.y;
    console.log(offsetX, offsetY, pixelWidth, pixelHeight);

    // Tiles.
    var southwestTile = TileService.getTile(bounds.southwest.lat, bounds.southwest.lng, zoomLevel);
    var northeastTile = TileService.getTile(bounds.northeast.lat, bounds.northeast.lng, zoomLevel);
    var xTileCount = northeastTile.x - southwestTile.x + 1;
    var yTileCount = southwestTile.y - northeastTile.y + 1;
    var total = xTileCount * yTileCount;

    var canvas = $document[0].createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    var context = canvas.getContext('2d');

    getNumbers(yTileCount).forEach(function(row) {
      getNumbers(xTileCount).forEach(function(col) {
        var x = southwestTile.x + col;
        var y = northeastTile.y + row;
        var image = createImage(x, y);
        image.addEventListener('load', function() {
          $log.debug('Loaded', x, y, image.src);

          context.drawImage(image, col * 256 - offsetX, row * 256 - offsetY);
          total--;

          if (total === 0) {
            $log.debug('Done');
            deferred.resolve({
              width: canvas.width,
              height: canvas.height,
              dataUrl: canvas.toDataURL('image/png')
            });
          }
        });
        image.addEventListener('error', function() {
          deferred.reject(new Error('Failed to load image: ' + image.src));
        });
      });
    });

    return deferred.promise;
  }

  function createImage(x, y) {
    var image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = TileService.getUrl(x, y, 15, 'ort', 'jpg');
    image.width = 256;
    image.height = 256;
    return image;
  }

  function getNumbers(size) {
    var result = [];
    for (var i = 0; i < size; i++) {
      result.push(i);
    }
    return result;
  }
})

.factory('TileService', function() {
  return {
    getTileUrl: getTileUrl,
    getTileUrls: getTileUrls,
    getTile: getTile,
    getUrl: getUrl,
    getPixelCoordinates: getPixelCoordinates
  };

  /**
  * Converts degree to radian.
  * @param {Number} degree
  * @returns {Number}
  */
  function degreeToRadian(degree) {
    return degree / 180.0 * Math.PI;
  }

  /**
  * Converts latitude and longitude in degree to world coordinates.
  * https://developers.google.com/maps/documentation/javascript/examples/map-coordinates
  * @param {Number} lat - latitude in degree
  * @param {Number} lng - longitude in degree
  * @returns {Number}
  */
  function getWorldCoordinates(lat, lng) {
    var latRadian = degreeToRadian(lat);
    var lngRadian = degreeToRadian(lng);

    var x = 128 / Math.PI * (lngRadian + Math.PI);
    var y = -128 / Math.PI / 2 * Math.log((1 + Math.sin(latRadian)) / (1 - Math.sin(latRadian))) + 128;

    return { x: x, y: y };
  }

  /**
  * Converts latitude and longitude in degree to pixel coordinates.
  * https://developers.google.com/maps/documentation/javascript/examples/map-coordinates
  * @param {Number} lat - latitude in degree
  * @param {Number} lng - longitude in degree
  * @param {Number} zoom - zoom level
  * @returns {Number}
  */
  function getPixelCoordinates(lat, lng, zoom) {
    var worldCoords = getWorldCoordinates(lat, lng);
    var scale = Math.pow(2, zoom);
    var x = worldCoords.x * scale;
    var y = worldCoords.y * scale;
    return { x: x, y: y };
  }

  /**
  * Get tile coordinates.
  * @param {Number} lat - latitude in degree
  * @param {Number} lng - longitude in degree
  * @param {Number} zoom
  * @returns {Object} an object with x and y
  */
  function getTile(lat, lng, zoom) {
    var worldCoords = getWorldCoordinates(lat, lng);

    var unit = 256 / Math.pow(2, zoom);

    var x = ~~(worldCoords.x / unit);
    var y = ~~(worldCoords.y / unit);

    return { x: x, y: y };
  }

  /**
  * Get tile image URL from geographical coordinates.
  * @param {Number} lat
  * @param {Number} lng
  * @param {Number} zoom
  * @param {String} id - tile type like 'std' and 'ort'
  * @param {String} ext - file extension
  * @returns {String} image URL
  */
  function getTileUrl(lat, lng, zoom, id, ext) {
    var xy = getTile(lat, lng, zoom);
    return getUrl(xy.x, xy.y, zoom, id, ext);
  }

  /**
  * Get tile image URL from position.
  * @param {Number} x
  * @param {Number} y
  * @param {Number} zoom
  * @param {String} id
  * @param {String} ext
  * @returns {String} image URL
  */
  function getUrl(x, y, zoom, id, ext) {
    var base = 'http://cyberjapandata.gsi.go.jp/xyz';
    return [base, id, zoom, x, y + '.' + ext].join('/');
  }

  /**
  * Get tile URLs in the given region.
  * @param {Number} southLat
  * @param {Number} westLng
  * @param {Number} northLat
  * @param {Number} eastLng
  * @param {Number} zoom
  * @param {String} id
  * @param {String} ext
  * @returns {Array} array of array of URLs
  */
  function getTileUrls(southLat, westLng, northLat, eastLng, zoom, id, ext) {
    var minXY = getTile(northLat, westLng, zoom);
    var maxXY = getTile(southLat, eastLng, zoom);

    var result = [];
    var row;
    for (var y = minXY.y; y <= maxXY.y; y++) {
      row = [];
      for (var x = minXY.x; x <= maxXY.x; x++) {
        row.push(getUrl(x, y, zoom, id, ext));
      }
      result.push(row);
    }
    return result;
  }
})

.factory('TerrainViewer', function(TileService) {
  // -------------------------
  // utility
  // -------------------------

  // degreeをradianに変換する
  function rad(degree) {
    return degree * Math.PI / 180;
  }

  var DEGREE_TO_METER = 6378150 * 2 * Math.PI / 360;

  // 経度・経度からピクセル座標に変換
  function coordToMeter(latitude, longitude) {
    // TODO: Parameterize zoom level.
    return TileService.getPixelCoordinates(latitude, longitude, 15);
  }

  // -------------------------


  /**
  * マウス・キーボードなどの入力機器の状態を
  * 把握し、保持する
  */
  function Input(container) {
    this.current = {
      position: new THREE.Vector2(),
      isMouseDown: false,
      isShiftDown: false,
      isCtrlDown: false
    };
    this.mouseDown = {}; // マウス押下時の状態
    this.previous = {}; // 前フレームの状態

    this.deltaFromDown = function() {
      return this.current.position.clone().sub(this.mouseDown.position);
    };

    this.deltaFromPrevious = function() {
      return this.current.position.clone().sub(this.previous.position);
    };

    this.update = function() {
      this.previous = this.clone();
    };
    this.updateDown = function() {
      this.mouseDown = this.clone();
    };
    this.clone = function() {
      var obj = _.clone(this.current);
      obj.position = this.current.position.clone();
      return obj;
    };
    this.isMousePress = function() {
      return (this.current.isMouseDown && !this.previous.isMouseDown);
    };

    // イベントへのリスナ割当を行う
    function on(type, func) {
      var elm = container;
      if ((/^key/).test(type)) {
        elm = window;
      }
      elm.addEventListener(
          type, func, false);
    }

    // イベント割当
    var self = this;
    on('mousedown', function(e){
      event.preventDefault();
      self.current.isMouseDown = true;
      self.updateDown();
    });

    on('mousemove', function(e){
      event.preventDefault();
      self.current.position.x = e.clientX;
      self.current.position.y = e.clientY;
    });

    on('mouseup', function(e){
      event.preventDefault();
      self.current.isMouseDown = false;
    });

    on('keydown', function(event) {
      switch( event.keyCode ) {
        case 16: self.current.isShiftDown = true; break;
        case 17: self.current.isCtrlDown = true; break;
      }
    });

    on('keyup', function(event) {
      switch ( event.keyCode ) {
        case 16: self.current.isShiftDown = false; break;
        case 17: self.current.isCtrlDown = false; break;
      }
    });

  }


  /**
  * 様々なリソースを管理する
  */
  function Resources() {
    this.cache = {};
    this.factories = {};
    this.register = function(key, factory) {
      this.factories[key] = factory;
    };

    this.get = function(key) {
      var obj = this.cache[key];
      if (!obj) {
        obj = this.create(key);
        this.cache[key] = obj;
      }
      return obj;
    };

    this.create = function(key) {
      var factory = this.factories[key];
      if (_.isFunction(factory)) {
        return factory();
      } else {
        return factory;
      }
    };
  }


  /**
  * 地形ビューア
  *
  * @param container 表示対象箇所のDOMエレメント
  */
  function TerrainViewer(container) {
    // 地形の地図画像とサイズを指定
    this.terrain = { image: null, width: 0, height: 0 };
    this.setTerrain = function(image, width, height) {
      this.terrain.image = image;
      this.terrain.width = width;
      this.terrain.height = height;
    };

    // 地形の中心点座標
    this.terrain.center = {latitude: 0, longitude: 0};
    this.setCenter = function(lat, lon) {
      this.terrain.center.latitude = lat;
      this.terrain.center.longitude = lon;

      var meter = coordToMeter(lat, lon);
      this.terrain.center.x = meter.x;
      this.terrain.center.y = meter.y;
    };

    // 地形の座標
    this.terrain.coordGrid = [];
    this.setCoordGrid = function(coordGrid, width, height) {
      this.terrain.coordGrid = coordGrid;
      this.terrain.coordGridWidth = width;
      this.terrain.coordGridHeight = height;
    };

    // 地図座標系と描画座標系の変換晩率
    this.convertRate = 1.0;
    this.setConvertRate = function(rate) {
      this.convertRate = rate;
    };

    // 経路パス
    this.route = [];
    this.setRoute = function(route) {
      this.route = route;
    };

    // 中心点からの相対位置をメートルで取得
    this.relativeFromCenter = function(lat, log) {
      var meter = coordToMeter(lat, log);
      return {
        x: meter.x - this.terrain.center.x,
        y: meter.y - this.terrain.center.y
      };
    };


    var self = this;
    var $r = new Resources();
    var input = new Input(container);

    this.setup = function() {
      this.initResources();
      this.draw();
    };

    this.initResources = function () {

      $r.register('l:ambient', new THREE.AmbientLight( 0x606060 ));
      $r.register('l:directional', new THREE.DirectionalLight(0xffffff));

      $r.register('g:grid', function () {
        var size = 5000, step = 250;
        var geometry = new THREE.Geometry();
        for ( var i = - size; i <= size; i += step ) {
          geometry.vertices.push( new THREE.Vector3( - size, 0, i ) );
          geometry.vertices.push( new THREE.Vector3(   size, 0, i ) );

          geometry.vertices.push( new THREE.Vector3( i, 0, - size ) );
          geometry.vertices.push( new THREE.Vector3( i, 0,   size ) );
        }
        return geometry;
      });

      $r.register('m:lightGray',
        new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true }));

      $r.register('o:basePlane', function() {
        var line = new THREE.Line($r.get('g:grid'), $r.get('m:lightGray'));
        line.type = THREE.LinePieces;
        return line;
      });


      $r.register('t:map', function() {
        return new THREE.ImageUtils.loadTexture(self.terrain.image);
      });

      $r.register('m:map',
        new THREE.MeshLambertMaterial({map: $r.get('t:map')})
      );

      $r.register('g:terrain', function() {
        var tr = self.terrain;

        var geometry = new THREE.PlaneGeometry(
            tr.width, tr.height, tr.coordGridWidth - 1, tr.coordGridHeight - 1 );
        geometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );

        for ( var i = 0, l = geometry.vertices.length; i < l; i ++ ) {
          geometry.vertices[ i ].y = tr.coordGrid[ i ];
        }

        geometry.computeFaceNormals();
        geometry.computeVertexNormals();
        return geometry;
      });

      $r.register('o:ground', function() {
        return new THREE.Mesh($r.get('g:terrain'), $r.get('m:map'))
      });


      $r.register('c:camera', function() {
        var camera = new THREE.PerspectiveCamera( 45,
        window.innerWidth / window.innerHeight,
        1, 10000 );
        camera.position.y = 200;
        return camera;
      });


      $r.register('g:route', function() {
        var geometry = new THREE.Geometry();
        var colors = [];
        for (var i = 0, l = self.route.length; i < l; i++) {
          var point = self.route[i];
          var pos = self.relativeFromCenter(point.lat, point.lon);
          // 地図とかぶらないように少し浮かせる。
          geometry.vertices[ i ] =
            new THREE.Vector3( pos.x, point.elev + 1, pos.y );

          colors[i] = new THREE.Color( 0xffffff );
          colors[i].setHSL( 0.6, 1.0, i / l * 0.5 + 0.5 );
        }
        geometry.colors = colors;
        return geometry;
      });

      $r.register('m:route', function() {
        return new THREE.LineBasicMaterial({
          color: 0xffffff, opacity: 1, linewidth: 3,
          vertexColors: THREE.VertexColors
        });
      });

      $r.register('o:route', function() {
        return new THREE.Line($r.get('g:route'), $r.get('m:route') );
      });
    }

    // メインシーン
    this.createScene = function() {

      var scene = new THREE.Scene();

      scene.add($r.get('l:ambient'));

      var directionalLight = $r.get('l:directional');
      directionalLight.position.set(1, 1, 1).normalize();
      scene.add(directionalLight);

      scene.add($r.get('o:basePlane'));
      scene.add($r.get('o:ground'));

      scene.add($r.get('o:route'));

      return scene;
    }


    // 描画メイン
    this.draw = function () {
      // fpsステータス表示
      var stats = new Stats();
      stats.domElement.style.position = 'absolute';
      stats.domElement.style.top = '0px';
      container.appendChild( stats.domElement );

      // レンダラ
      var renderer = new THREE.WebGLRenderer();
      renderer.setClearColor( 0xf0f0f0 );
      renderer.setSize( container.offsetWidth, container.offsetHeight );
      console.log(container.offsetWidth, container.offsetHeight );
      container.appendChild( renderer.domElement );

      var scene = this.createScene();

      // レンダリングループ
      var self = this;
      function render(renderer, scene) {
        requestAnimationFrame(function() {
          render(renderer, scene);
        });

        update(scene);

        renderer.render(scene, self.getCamera());
        stats.update();
      }

      render(renderer, scene);

      // 画面リサイズ対応
      container.addEventListener('resize', function () {
          var camera = this.getCamera();
          camera.aspect = container.offsetWidth / container.offsetHeight;
          camera.updateProjectionMatrix();
          renderer.setSize( container.offsetWidth, container.offsetHeight );
        }, false );
    }


    this.getCamera = function() {
      return $r.get('c:camera');
    };


    var angle = {theta: 25, phi: 15};
    var radious = 1600;
    var mouseDown = {};

    function update(scene) {
      if (input.isMousePress()) {
        mouseDown.angle = _.clone(angle);
        mouseDown.radious = radious;
      }

      if (input.current.isMouseDown) {
        var delta = input.deltaFromDown();
        if (input.current.isShiftDown) {
          //ズーム
          radious = mouseDown.radious + delta.y * 10;

        } else {
          // 回転
          angle.theta = - delta.x + mouseDown.angle.theta;
          angle.phi = Math.min(90, Math.max(0,
                delta.y + mouseDown.angle.phi));
        }
      }

      var camera = $r.get('c:camera');
      camera.position.x = Math.sin( rad(angle.theta) ) * Math.cos( rad(angle.phi) );
      camera.position.y = Math.sin( rad(angle.phi) );
      camera.position.z = Math.cos( rad(angle.theta) ) * Math.cos( rad(angle.phi) );
      camera.position.multiplyScalar(radious);

      camera.updateMatrix();
      camera.lookAt( scene.position );

      input.update();
    };
  }

  return TerrainViewer;
});
