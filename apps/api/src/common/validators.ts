import { registerDecorator, ValidationOptions } from 'class-validator';
import { isDateOnly } from './dates';

/** Validates a strict `YYYY-MM-DD` calendar date (or each element when `each: true`). */
export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: `${String(propertyName)} must be a YYYY-MM-DD date`, ...options },
      validator: { validate: (value: unknown) => isDateOnly(value) },
    });
  };
}
