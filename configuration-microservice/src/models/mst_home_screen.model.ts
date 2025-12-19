import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt } from 'sequelize-typescript';

export interface HomeScreenAttributes {
  id: number;
  name: string;
  lang: object;
  label: '0' | '1' | '2';
  key: string;
  is_enabled: boolean;
  is_locked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface HomeScreenCreationAttributes extends Optional<HomeScreenAttributes, 'id'> {}

@Table({
    timestamps: true,
    tableName: "mst_home_screen"
})
export class HomeScreen extends Model<HomeScreenCreationAttributes, HomeScreenCreationAttributes> {
    @Column({
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    })
    id!: number;

    @Column({
      type: DataTypes.STRING,
      allowNull: true
    })
    name!: string;

    @Column({
      type: DataTypes.JSON,
      allowNull: true
    })
    lang!: object;

    @Column({
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    })
    key!: string;

    @Column({
      type: DataTypes.BOOLEAN,
      defaultValue: false
    })
    is_editable!: boolean;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_enabled!: boolean;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_locked!: boolean;

    @Column({
      type: DataTypes.ENUM('0', '1', '2'),
      allowNull: true
    })
    label!: '0' | '1' | '2';

    @CreatedAt
    @Column
    createdAt!: Date;

    @UpdatedAt
    @Column
    updatedAt!: Date;
}
