import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt } from 'sequelize-typescript';

export interface IhFhirModuleAttributes {
  id: number;
  name: string;
  lang: object;
  sub_sections: object[];
  key: string;
  order: number;
  is_editable: boolean;
  is_enabled: boolean;
  is_locked: boolean;
  platform?: 'Mobile' | 'Webapp' | 'Both';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IhFhirModuleCreationAttributes extends Optional<IhFhirModuleAttributes, 'id'> {}

@Table({
  timestamps: true,
  tableName: 'mst_ih_fhir_module',
})
export class IhFhirModule extends Model<IhFhirModuleCreationAttributes, IhFhirModuleCreationAttributes> {
  @Column({
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataTypes.STRING,
    allowNull: true,
  })
  name!: string;

  @Column({
    type: DataTypes.JSON,
    allowNull: true,
  })
  lang!: object;

  @Column({
    type: DataTypes.JSON,
    allowNull: true,
  })
  sub_sections!: object[];

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  })
  key!: string;

  @Column({
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  order!: number;

  @Column({
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  })
  is_editable!: boolean;

  @Column({
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  })
  is_enabled!: boolean;

  @Column({
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  })
  is_locked!: boolean;

  @Column({
    type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
    allowNull: true,
  })
  platform!: 'Mobile' | 'Webapp' | 'Both';

  @CreatedAt
  @Column
  createdAt!: Date;

  @UpdatedAt
  @Column
  updatedAt!: Date;
}
