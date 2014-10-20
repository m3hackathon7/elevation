(function() {

  // -------------------------
  // utility
  // -------------------------

  // degreeをradianに変換する
  function rad(degree) {
    return degree * Math.PI / 180;
  }

  var DEGREE_TO_METER = 6378150 * 2 * Math.PI / 360;

  // 経度・経度からメートル座標に変換
  function coordToMeter(latitude, longitude) {
    return {
      x: DEGREE_TO_METER * longitude,
      y: DEGREE_TO_METER * latitude // TODO: メルカトル図法計算
    };
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
    this.setTerrain = function(image, eastLng, westLng, southLat, northLat) {
      this.terrain.image = image;

      // 地形の中心点を設定。
      var centerLat = (southLat + northLat) / 2;
      var centerLng = (westLng + eastLng) / 2;
      this.setCenter(centerLat, centerLng);
      console.log('Center', centerLat, centerLng);

      // 地形のサイズを設定。
      var southWest = coordToMeter(southLat, westLng);
      var northEast = coordToMeter(northLat, eastLng);
      console.log(northEast.x - southWest.x);
      this.terrain.width = Math.abs(northEast.x - southWest.x);
      this.terrain.height = Math.abs(northEast.y - southWest.y);
      console.log('Terrain size', this.terrain.width, this.terrain.height);
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

      $r.register('g:cursor', function() {
        var geo = new THREE.CylinderGeometry(50, 0, 100);
        geo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 50, 0));
        return geo;
      });

      $r.register('m:cursor', function() {
        return new THREE.MeshBasicMaterial({ color: 0x90D0D0, opacity: 0.7});
      });

      $r.register('o:cursor', function() {
        return new THREE.Mesh($r.get('g:cursor'), $r.get('m:cursor') );
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

      scene.add($r.get('o:cursor'));
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

    this.setCursorPosition = function(lat, lon, elev) {
      var cursor = $r.get('o:cursor');
      var meter = this.relativeFromCenter(lat, lon);
      cursor.position.x = meter.x;
      cursor.position.z = meter.y;
      cursor.position.y = elev;
    };


    var angle = {theta: 25, phi: 15};
    var radious = 1600;
    var lookAt = new THREE.Vector3();
    var mouseDown = {};

    function update(scene) {
      var camera = $r.get('c:camera');

      if (input.isMousePress()) {
        mouseDown.angle = _.clone(angle);
        mouseDown.radious = radious;
        mouseDown.lookAt = lookAt.clone();
      }

      if (input.current.isMouseDown) {
        var delta = input.deltaFromDown();
        if (input.current.isCtrlDown) {
          //ズーム
          radious = mouseDown.radious + delta.y * 10;

        } else if (input.current.isShiftDown) {
          // 水平移動
          var eye = new THREE.Vector3().subVectors( camera.position, lookAt );
          var objectUp = new THREE.Vector3();
          var pan = new THREE.Vector3();
          pan.copy(eye).cross(camera.up).setLength(delta.x);
          pan.add(objectUp.copy(camera.up).setLength(delta.y));

          lookAt.copy( mouseDown.lookAt ).add(pan);

        } else {
          // 回転
          angle.theta = - delta.x + mouseDown.angle.theta;
          angle.phi = Math.min(90, Math.max(0,
                delta.y + mouseDown.angle.phi));
        }
      }

      camera.position.x = Math.sin( rad(angle.theta) ) * Math.cos( rad(angle.phi) );
      camera.position.y = Math.sin( rad(angle.phi) );
      camera.position.z = Math.cos( rad(angle.theta) ) * Math.cos( rad(angle.phi) );
      camera.position.multiplyScalar(radious);
      camera.position.add(lookAt);

      camera.updateMatrix();
      camera.lookAt( lookAt );

      input.update();
    };
  }


  window.TerrainViewer = TerrainViewer;
})();

