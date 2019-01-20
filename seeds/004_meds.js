
exports.seed = function(knex, Promise) {
  // Deletes ALL existing entries
  return knex('meds').del()
    .then(function () {
      // Inserts seed entries
      return knex('meds').insert([
        {id: 1, generic_name: 'Brentuximab vedotin', brand_name: 'Adcetris', pharma_company:'Farm Co.', info:'Adcetris is drug for oncology treatment', photo:'https://i.pinimg.com/474x/ec/7d/ef/ec7def884205db98a059db3dee0d189c--munchkin-cat-cat-sitting.jpg'},
        {id: 2, generic_name: 'Everolimus', brand_name: 'Afinitor', pharma_company:' Afinitor Farm Co.', info:'Everolimus is a drug for oncology treatment', photo:'https://i.pinimg.com/474x/ec/7d/ef/ec7def884205db98a059db3dee0d189c--munchkin-cat-cat-sitting.jpg'},
        {id: 3, generic_name: 'Anastrozole', brand_name: 'Arimidex', pharma_company:'Arimidex Farma Company', info:'Arimidex is a Drug for oncology treatment', photo:'https://i.pinimg.com/474x/ec/7d/ef/ec7def884205db98a059db3dee0d189c--munchkin-cat-cat-sitting.jpg'},
        {id: 4, generic_name: 'Exemestane', brand_name: 'Aromasin', pharma_company:'Aromasin Farma Company', info:'Aromasin Drug for oncology treatment', photo:'https://i.pinimg.com/474x/ec/7d/ef/ec7def884205db98a059db3dee0d189c--munchkin-cat-cat-sitting.jpg'},
        {id: 5, generic_name: 'Bevacizumab', brand_name: 'Avastin', pharma_company:'Avastin Farma Company', info:'Avastin is aDrug for oncology treatment', photo:'https://i.pinimg.com/474x/ec/7d/ef/ec7def884205db98a059db3dee0d189c--munchkin-cat-cat-sitting.jpg'}
      ]);
    })
    .then(function () {
      //Moves id column (PK) auto-incremented to correct value after inserts
      return knex.raw(`SELECT setval('meds_id_seq', (SELECT MAX(id) FROM meds))`)
    })
}
