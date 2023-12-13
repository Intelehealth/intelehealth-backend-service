"use strict";

const getColumns = (Sequelize) => {
  let tableName = "pushnotification";
  let columns = [
    { name: "createdAt", type: Sequelize.DATE },
    { name: "updatedAt", type: Sequelize.DATE },
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
          let opts = { ...column };
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
