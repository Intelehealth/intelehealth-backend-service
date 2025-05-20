import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column, CreatedAt, UpdatedAt, DeletedAt } from 'sequelize-typescript';

export interface PublishAttributes {
  id: number;
  name: string;
  path: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PublishCreationAttributes extends Optional<PublishAttributes, 'id'> {}

@Table({
    timestamps: true,
    tableName: "dic_publish"
})
export class Publish extends Model<PublishAttributes, PublishCreationAttributes> {
    @Column({
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    })
    id!: number;

    @Column({
        type: DataTypes.STRING,
        allowNull: false
    })
    name!: string;

    @Column({
        type: DataTypes.STRING,
        allowNull: false
    })
    path!: string;

    @CreatedAt
    @Column
    createdAt!: Date;

    @UpdatedAt
    @Column
    updatedAt!: Date;
}