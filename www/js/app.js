angular.module('elevation', [
  'ionic',
  'ngCordova',
  'elevation.route',
  'elevation.friends',
  'elevation.terrain'
])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
  });
})

.config(function(RoutesProvider, ElevationsProvider) {
  // Use API proxy for browser testing.
  if (!window.cordova) {
    RoutesProvider.setUrl('http://localhost:3333/routes');
    ElevationsProvider.setUrl('http://localhost:3333/elevations');
  }
})

.controller('RootCtrl', function($scope,
                                 $log,
                                 $ionicPopup,
                                 $cordovaGeolocation,
                                 Location,
                                 Routes) {
  var self = this;

  self.search = function() {
    Routes.search(self.from, self.to)
      .then(function(route) {
        $log.debug(route);
        self.route = route;
      }, function(error) {
        $log.error('Failed to search route:', error);
        $ionicPopup.alert({
          title: 'Error',
          template: 'Failed to search route.'
        });
        self.route = null;
      });
  };

  self.hasRoute = function() {
    return !!self.route;
  };

  self.showSearchPopup = function() {
    $ionicPopup.show({
      templateUrl: 'templates/route-search-popup.html',
      title: 'Search',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: 'Search',
          type: 'button-positive',
          onTap: function() {
            self.search();
          }
        }
      ]
    });
  };

  var watchID = $cordovaGeolocation.watchPosition({
    frequency : 10000,
    timeout : 5000,
    enableHighAccuracy: true
  });
  watchID.promise.then(function()  { /* Not  used */ },
    function(error) {
      $log.error(error);
    }, function(position) {
      self.position = position;
    });

  self.setCurrentLocation = function(fromOrTo) {
    if (self.position) {
      var current = self.position.coords;
      self[fromOrTo] = current.latitude + ',' + current.longitude;
    }
  };
})

.config(function($stateProvider, $urlRouterProvider) {

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider

    // setup an abstract state for the tabs directive
    .state('tab', {
      url: '/tab',
      abstract: true,
      templateUrl: 'templates/tabs.html'
    })

    // Each tab has its own nav history stack:

    .state('tab.route', {
      url: '/route',
      views: {
        'tab-route': {
          templateUrl: 'templates/tab-route.html',
          controller: 'RouteCtrl as route'
        }
      }
    })

    .state('tab.friends', {
      url: '/friends',
      views: {
        'tab-friends': {
          templateUrl: 'templates/tab-friends.html',
          controller: 'FriendsCtrl'
        }
      }
    })
    .state('tab.friend-detail', {
      url: '/friend/:friendId',
      views: {
        'tab-friends': {
          templateUrl: 'templates/friend-detail.html',
          controller: 'FriendDetailCtrl'
        }
      }
    })

    .state('tab.terrain', {
      url: '/terrain',
      views: {
        'tab-terrain': {
          templateUrl: 'templates/tab-terrain.html',
          controller: 'TerrainCtrl as terrain'
        }
      }
    });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/tab/route');

});
