"use strict";

const getColumns = (Sequelize) => {
  const tableName = "appointments";
  const columns = [
    { name: "patientAge", type: Sequelize.STRING },
    { name: "patientGender", type: Sequelize.STRING },
    { name: "patientPic", type: Sequelize.STRING },
    { name: "hwPic", type: Sequelize.STRING },
    { name: "hwName", type: Sequelize.STRING },
    { name: "hwGender", type: Sequelize.STRING },
    { name: "hwAge", type: Sequelize.STRING },
    { name: "type", type: Sequelize.STRING },
  ];
  return { columns, tableName };
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { columns, tableName } = getColumns(Sequelize);
    return Promise.all(
      columns.map((column) => {
        queryInterface.describeTable(tableName).then((tableDefinition) => {
          if (tableDefinition[column.name]) return Promise.resolve();
          const opts = { ...column };
          delete opts.name;
          return queryInterface.addColumn(tableName, column.name, opts);
        });
      })
    );
  },

  down: async (queryInterface, Sequelize) => {
    const { columns, tableName } = getColumns(Sequelize);
    return Promise.all(
      columns.map((column) => {
        queryInterface.describeTable(tableName).then((tableDefinition) => {
          if (tableDefinition[column.name]) return Promise.resolve();
          return queryInterface.removeColumn(tableName, column.name, {
            type: column.type,
          });
        });
      })
    );
  },
};
