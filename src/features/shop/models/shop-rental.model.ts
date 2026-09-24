import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';

@index({ userId: 1, itemId: 1 }, { unique: true })
@index({ expiresAt: 1 })
export class ShopRental {
  @prop({ required: true })
  userId!: string;

  @prop({ required: true })
  itemId!: string;

  @prop()
  variantId?: string;

  @prop({ required: true })
  expiresAt!: Date;
}

const ShopRentalModel = getModelForClass(ShopRental, {
  schemaOptions: { collection: 'shop_rentals', timestamps: true },
});

export type IShopRental = DocumentType<ShopRental>;
export default ShopRentalModel;
