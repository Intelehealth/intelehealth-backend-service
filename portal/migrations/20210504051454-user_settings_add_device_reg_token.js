"use strict";

const getColumns = (Sequelize) => {
  const tableName = "user_settings";
  const columns = [
    { name: "device_reg_token", type: Sequelize.STRING },
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
