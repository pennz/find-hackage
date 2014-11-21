'use strict';

angular.module('findHackageApp', ['ngRoute', 'angulartics', 'angulartics.google.analytics'])

.config(function($routeProvider){ // {{{
  $routeProvider
    .when('/', { templateUrl: 'views/index.html', controller: 'IndexController'})
    .when('/q', { templateUrl: 'views/search.html',
                  controller: 'SearchController',
                  reloadOnSearch: false
                })
    .otherwise({redirectTo: '/'})
}) // }}}

// page title service/directive
//
// pageTitle.set(title): set page title.
//
.factory('pageTitle', function($q){ // {{{
  var title = $q.defer();
  return {
    set: function(new_title){ title.notify(new_title); },
    observe: function(func){
      title.promise.then(null, null, func);
    }
  }
})

.directive('pageTitle', function(pageTitle){ 
  return {
    restrict: 'E',
    template: '<title>{{title}}</title>',
    replace: true,
    scope: {},
    link: function(scope){
      pageTitle.observe(function(title){
        scope.title = 'find hackage' + (title ? ' - ' + title : '');
      });
    }
  }
}) // }}}

// navigationBar service/directive
//
// navigationBar.searchbox.show(): show navigation search box.
// navigationBar.searchbox.hide(): hide navigation search box.
// navigationbar.query
//
.factory('navigationBar', function($q){ // {{{
  var searchbox = $q.defer();
  return {
    searchbox: {
      show: function(){ searchbox.notify(true);},
      hide: function(){ searchbox.notify(false);},
      observe: function(func) {
        searchbox.promise.then(null, null, func);
      }
    },
    query: ""
  }
})

.directive('navigationBar', function(navigationBar){
  return {
    restrict: 'E',
    templateUrl: 'parts/navigationBar.html',
    scope: {brand: '@'},
    controller: 'NavigationBarController',
    link: function(scope){
      scope.navBar = navigationBar;
      navigationBar.searchbox.observe(function(bool){
        scope.searchbox = bool;
      });
    }
  }
}) // }}}

// raw backend api access service
//
// backend.update():  /update return $http object.
// backend.check(q):  check query string. return $q promise.
// backend.query(q):  /search return $http object.
// backend.search(q): jump to search result page.
//
.factory('backend', function($http, $q, $location){ // {{{
  return {
    updated: function(){
      return $http({method: 'GET', url: '/updated'});
    },
    search: function(q){
      var clean = {};
      clean.page = q.page;
      clean.q    = q.q;
      $location.path('/q').search(clean);
    },
    total: function(){
      return $http({method: 'GET', url: '/packages'});
    },
    check: function(str, page){

      var deferred = $q.defer();
      if(typeof(str) !== 'string') { deferred.reject('query string is not string.'); }
      else if (str.length === 0) { deferred.reject('query string is empty.'); }

      var req = {q: str};
      var pint = parseInt(page);
      if(isNaN(pint)){
        deferred.reject('page is unknown type.');
      } else if(pint <= 0) {
        deferred.reject('page is negative.');
      } else {
        req.page = pint;
      }

      deferred.resolve(req);

      return deferred.promise;
    },
    query: function(req){
      req.skip = (req.page - 1) * 10;
      return $http({method: 'GET', url: '/search', params: req});
    }

  }
}) // }}}

.directive('searchBox', function(){ // {{{
  return {
    restrict: 'E',
    scope: {error: '=', ngModel: '='},
    requre: 'ngModel',
    template: '<div ng-class="{\'has-error\': error}"><input type="text" class="form-control" placeholder="{{error || \'search\'}}" ng-model="ngModel"></div>'

  }
}) // }}}

.directive('pagination', function(){ // {{{
  return {
    restrict: 'E',
    scope: {page: '=', nPage: '=', setPage: '='},
    transclude: true,
    replace: true,
    templateUrl: "parts/pagination.html",
    link: function(scope){
      scope.$watch('nPage', function(nPage){
        if(!nPage){return}
        scope.lastPage = nPage;

        scope.$watch('page', function(page){
          if(scope.lastPage < 8) {
            scope.pages = [1,2,3,4,5,6,7,8].slice(0, scope.lastPage);
          } else if(page < 5) {
            scope.pages = [1,2,3,4,5,null,scope.lastPage];
          } else if (scope.lastPage - page < 4) {
            var lp = scope.lastPage;
            scope.pages = [1,null,lp-4,lp-3,lp-2,lp-1,lp];
          } else {
            scope.pages = [1,null,page - 1, page, page + 1, null, scope.lastPage];
          }
        });
      });
    }
  }
}) // }}}

.controller('IndexController', function($scope, pageTitle, navigationBar, backend, $window) { // {{{
  pageTitle.set('index');
  navigationBar.searchbox.hide();
  $scope.navBar = navigationBar;

  backend.updated().success(function(data){
    $scope.updated = new Date(data.date);
  });

  backend.total().success(function(data){
    $scope.total = data;
  });

  $scope.imFeelingLucky = function(){
    backend.check($scope.navBar.query, 1).then(function(query){
      backend.query(query)
        .success(function(data){
          var page = "http://hackage.haskell.org/package/" + data.result[0].name;
          $window.location.href = page;
        }).fail(function(err){
          $scope.error = err;
        });
    }, function(err){ $scope.error = err; })
  }


  $scope.search = function(){
    backend.check($scope.navBar.query, 1).then(function(query){
      backend.search(query);
      $scope.error = null;
    }, function(err){
      $scope.error = err;
    });
  }

}) // }}}

.controller('NavigationBarController', function($scope, backend){ // {{{
  $scope.search = function(){
    backend.check($scope.navBar.query, 1).then(function(query){
      $scope.error = null;
      backend.search(query);
    }, function(err){
      $scope.error = err;
    });
  }
}) // }}}

.controller('SearchController', function($scope, $location, backend, navigationBar, $route, pageTitle, $anchorScroll){ // {{{
  navigationBar.searchbox.show();
  $scope.navBar       = navigationBar;
  $scope.navBar.query = $location.search().q;
  $scope.queryString  = $scope.navBar.query;
  $scope.page         = parseInt($location.search().page) || 1;
  pageTitle.set($scope.queryString);

  $scope.setPage = function(p){
    $scope.page = p;
    var search = $location.search();
    search.page = p;
    $location.search(search);
    $location.hash('search-result');
    $anchorScroll();
    $location.hash(null);
  }

  $scope.search = backend.search;

  $scope.$on('$routeUpdate', function(next, current){
    if ($scope.queryString != current.params.q) {
      $route.reload();
    }
  });

  $scope.$watch('page', function(page){
    if(!page){return}
    backend.check($location.search().q, page).then(function(query){
      backend.query(query)
        .success(function(data){
          $scope.nPage = data.pages;
          $scope.count = data.count;
          $scope.items = data.result;
        });
    }, function(err){
      console.log(err);
    });
  });

}); // }}}
