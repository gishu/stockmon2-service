

var app = angular.module('myAngApp', ['ngTouch', 'ui.grid', 'myAngServices']);

app.controller('MainCtrl', ['$scope', 'TradeService', 'uiGridConstants', function ($scope, tradesService, gridConstants) {
    $scope.gridViewModel = {
        enableFiltering: true,

        columnDefs: [
            { name: 'Date', field: 'date', sort: {direction: gridConstants.DESC, priority:0} },
            { name: 'Stock', field: 'stock' },
            { name: 'Qty', field: 'qty' },
            { name: 'Price', field: 'price' },
            { name: 'B/S', field: 'type' }
        ],
        data: []
    };

    tradesService.getTrades(1).then(trades => {
        $scope.gridViewModel.data = trades;  
    });
    
}]);

