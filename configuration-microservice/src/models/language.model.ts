import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface LanguageAttributes {
  id: number;
  name: string;
  code: string;
  is_default: boolean;
  is_enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface LanguageCreationAttributes extends Optional<LanguageAttributes, 'id'> {}

@Table({
    timestamps: true,
    paranoid: true,
    tableName: "mst_language"
})
export class Language extends Model<LanguageAttributes, LanguageCreationAttributes> {
    @Column({
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    })
    id!: number;

    @Column({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    name!: string;

    @Column({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    code!: string;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_default!: boolean;

    @Column({
        type: DataTypes.BOOLEAN,
        defaultValue: false
    })
    is_enabled!: boolean;

    @CreatedAt
    @Column
    createdAt!: Date;

    @UpdatedAt
    @Column
    updatedAt!: Date;

    @DeletedAt
    @Column
    deletedAt!: Date;
}