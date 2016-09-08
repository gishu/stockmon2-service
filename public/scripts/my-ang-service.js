
(function () {

    var serviceModule = angular.module('myAngServices', []);

    serviceModule.service('TradeService', ['$http', '$q', tradeSvcFactory]);

    function tradeSvcFactory($http, $q) {
        return {
            getTrades: function (accountId) {
                var trades = $q.defer();

                $http({
                    method: 'GET',
                    url: '/accounts/' + accountId + '/trades',
                    headers: { 'Accept': 'application/json' }
                }).then(
                    function (resp) {
                        console.log('Got data');
                        trades.resolve(resp.data);
                    },
                    function (error) {
                        trades.reject(error);
                    });
                return trades.promise;
            }
        };
    }

})();
