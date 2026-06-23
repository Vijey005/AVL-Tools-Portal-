import { Pipe, PipeTransform } from '@angular/core';

/** Joins a string array with a separator, filtering out empty values */
@Pipe({ name: 'join', standalone: true })
export class JoinPipe implements PipeTransform {
  transform(value: (string | undefined | null)[], separator = ', '): string {
    return (value || []).filter(Boolean).join(separator);
  }
}
