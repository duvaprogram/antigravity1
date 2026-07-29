const assert = require('assert');

// Simulate the issue
const saleName = "My Product";
const adExpenses = [
    { id: 1, campaign_name: "Camp 1", amount_spent: "100.50", product_name: null },
    { id: 2, campaign_name: "Camp 2", amount_spent: "50", product_name: "My Product" }
];

const selectedCampaigns = ["Camp 1"];
const unselectedCampaigns = ["Camp 2"];

let recordsUpdated = 0;
for (let exp of adExpenses) {
    const campName = exp.campaign_name || 'Sin Nombre de Campaña';
    
    if (selectedCampaigns.includes(campName)) {
        if (exp.product_name !== saleName) {
            exp.product_name = saleName;
            recordsUpdated++;
        }
    } else if (unselectedCampaigns.includes(campName) && exp.product_name === saleName) {
        exp.product_name = null;
        recordsUpdated++;
    }
}

console.log("Updated:", recordsUpdated);
console.log(adExpenses);

// Filter logic
const filteredAdExpenses = adExpenses; // assuming all passed
const sale = { description: "My Product" };

let adSpend = 0;
if (sale.description) {
    adSpend = filteredAdExpenses
        .filter(exp => exp.product_name === sale.description)
        .reduce((sum, exp) => sum + parseFloat(exp.amount_spent || 0), 0);
}

console.log("AdSpend:", adSpend);
