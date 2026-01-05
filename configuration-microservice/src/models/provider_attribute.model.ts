import { DataTypes, Optional } from 'sequelize';
import { Table, Model, Column } from 'sequelize-typescript';

export interface ProviderAttributes {
  provider_attribute_id: number;
  provider_id: number;
  attribute_type_id: number;
  value_reference: string;
  uuid: string;
  creator: number;
  date_created: Date;
  changed_by?: number;
  date_changed?: Date;
  voided?: boolean;
  voided_by?: number;
  date_voided?: Date;
  void_reason?: string;
}

export interface CreationProviderAttributes extends Optional<ProviderAttributes, 'provider_attribute_id'> {}

@Table({
    timestamps: false,
    tableName: "provider_attribute"
})
export class ProviderAttribute extends Model<ProviderAttributes, CreationProviderAttributes> {
    @Column({
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    })
    provider_attribute_id!: number;

    @Column({
        type: DataTypes.INTEGER,
        allowNull: false
    })
    provider_id!: number;

    @Column({
        type: DataTypes.INTEGER,
        allowNull: false
    })
    attribute_type_id!: number;

    @Column({
        type: DataTypes.STRING,
        allowNull: false
    })
    value_reference!: string;

    @Column({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    uuid!: string;

    @Column({
        type: DataTypes.INTEGER,
        allowNull: false
    })
    creator!: number;

    @Column({
        type: DataTypes.DATE,
        allowNull: false
    })
    date_created!: Date;

    @Column({
        type: DataTypes.INTEGER,
        defaultValue: null
    })
    changed_by!: number;

    @Column({
        type: DataTypes.DATE,
        defaultValue: null
    })
    date_changed!: Date;

    @Column({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0
    })
    voided!: boolean;

    @Column({
        type: DataTypes.INTEGER,
        defaultValue: null
    })
    voided_by!: number;

    @Column({
        type: DataTypes.DATE,
        defaultValue: null
    })
    date_voided!: Date;

    @Column({
        type: DataTypes.STRING,
        defaultValue: null
    })
    void_reason!: string;
}