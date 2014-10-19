angular.module('elevation.texture', [])

.controller('TextureCtrl', function($scope) {
})

.factory('TextureService', function() {
  return {
    getTileUrl: getTileUrl,
    getTileUrls: getTileUrls
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
    var url = [
      'http://cyberjapandata.gsi.go.jp/xyz/',
      id,
      '/',
      zoom,
      '/',
      x,
      '/',
      y,
      '.',
      ext
    ].join('');
    return url;
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
});
