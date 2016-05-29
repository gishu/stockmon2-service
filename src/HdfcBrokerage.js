module.exports = function(qty, price, isSale){
    var hdfc_brokerage = isSale ? 0.0069 : 0.0067 ;
    return price.times(qty).times(hdfc_brokerage).round(2);
};