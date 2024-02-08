const {
  sequelize
} = require("../../openmrs_models");
const connectDatabase = {
  query: async function(query, callback){
    let error, metadata= null;
    let result = [];
    try{
      [result, metadata] = await sequelize.query(query);
    } catch(err){
      error = err;
    }
    if(callback && typeof callback === 'function') callback(error,result,metadata);
  }
};

module.exports = connectDatabase;