import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

export class ColorRole {
  @prop({ required: true, unique: true })
  userId!: string;

  @prop({ required: true })
  roleId!: string;
}

const ColorRoleModel = getModelForClass(ColorRole, {
  schemaOptions: { collection: 'shop_color_roles', timestamps: true },
});

export type IColorRole = DocumentType<ColorRole>;
export default ColorRoleModel;
