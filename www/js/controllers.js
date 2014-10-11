angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope, $log, Routes) {
  var self = this;

  self.search = function() {
    Routes.search(self.from, self.to)
      .then(function(routes) {
        $log.debug(routes);
        self.routes = routes;
      });
  };
})

.controller('FriendsCtrl', function($scope, Friends) {
  $scope.friends = Friends.all();
})

.controller('FriendDetailCtrl', function($scope, $stateParams, Friends) {
  $scope.friend = Friends.get($stateParams.friendId);
})

.controller('AccountCtrl', function($scope) {
});
