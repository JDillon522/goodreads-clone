import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';

type UiFormControlKind = 'input' | 'select';
type UiFormControlSize = 'compact' | 'default';
type UiFormInputType = 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'url';
type UiFormField = FieldTree<number> | FieldTree<string>;

let nextFormControlId = 0;

@Component({
  selector: 'app-form-control',
  imports: [FormField],
  templateUrl: './form-control.html',
  styleUrl: './form-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiFormControl {
  protected readonly messageId = `ui-form-control-${++nextFormControlId}-message`;

  public readonly autocomplete = input('');
  public readonly control = input.required<UiFormField>();
  public readonly hint = input('');
  public readonly icon = input('');
  public readonly kind = input<UiFormControlKind | 'textarea'>('input');
  public readonly label = input.required<string>();
  public readonly rows = input(4);
  public readonly size = input<UiFormControlSize>('default');
  public readonly type = input<UiFormInputType>('text');

  protected readonly fieldState = computed(() => this.control()());
  protected readonly showError = computed(() => {
    const state = this.fieldState();

    return state.invalid() && (state.touched() || state.dirty());
  });
  protected readonly errorText = computed(() => {
    if (!this.showError()) {
      return '';
    }

    return this.fieldState().errors()[0]?.message ?? 'This field needs attention.';
  });
  protected readonly messageText = computed(() => this.errorText() || this.hint());
  protected readonly describedBy = computed(() => (this.messageText() ? this.messageId : null));

  protected inputControl(): FieldTree<number | string> {
    return this.control() as FieldTree<number | string>;
  }

  protected textControl(): FieldTree<string> {
    return this.control() as FieldTree<string>;
  }
}
