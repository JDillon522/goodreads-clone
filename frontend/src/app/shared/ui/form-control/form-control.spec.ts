import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';

import { UiFormControl } from './form-control';

@Component({
  imports: [UiFormControl],
  template: `
    <app-form-control label="Name" [control]="testForm.name" />
    <app-form-control label="Quantity" type="number" [control]="testForm.quantity" />
    <app-form-control label="Shelf" kind="select" [control]="testForm.shelf">
      <option value="read">Read</option>
      <option value="fantasy">Fantasy</option>
    </app-form-control>
    <app-form-control label="Notes" kind="textarea" [rows]="5" [control]="testForm.notes" />
  `,
})
class FormControlHost {
  public readonly model = signal({
    name: '',
    notes: 'Initial notes',
    quantity: 2,
    shelf: 'read',
  });
  public readonly testForm = form(this.model, (path) => {
    required(path.name, { message: 'Name is required.' });
  });
}

describe('UiFormControl', () => {
  it('renders native input, number input, select, and textarea controls', async () => {
    const fixture = TestBed.createComponent(FormControlHost);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector<HTMLInputElement>('input[type="text"]')).toBeTruthy();
    expect(element.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('2');
    expect(element.querySelector<HTMLSelectElement>('select')?.value).toBe('read');
    expect(element.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Initial notes');
  });

  it('shows the field validation message after the field is touched', async () => {
    const fixture = TestBed.createComponent(FormControlHost);
    await fixture.whenStable();

    fixture.componentInstance.testForm.name().markAsTouched();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Name is required.');
  });
});
