import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, max, min, required, submit } from '@angular/forms/signals';

import type { ReadingGoalResponse } from '../../core/api/api.types';
import { Goals as GoalsService } from '../../core/goals/goals';
import { UiFormControl } from '../../shared/ui/form-control/form-control';

@Component({
  selector: 'app-goals',
  imports: [UiFormControl],
  templateUrl: './goals.html',
  styleUrl: './goals.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Goals {
  private readonly goals = inject(GoalsService);
  private readonly year = new Date().getFullYear();
  private readonly model = signal({ targetBooks: 12 });

  protected readonly goal = signal<ReadingGoalResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly goalForm = form(this.model, (path) => {
    required(path.targetBooks);
    min(path.targetBooks, 1);
    max(path.targetBooks, 500);
  });

  public constructor() {
    void this.loadGoal();
  }

  protected currentYear(): number {
    return this.year;
  }

  protected async submitGoal(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.status.set(null);

    const successful = await submit(this.goalForm, async (formTree) => {
      const response = await this.goals.update(this.year, formTree().value());
      this.goal.set(response);
      this.status.set('Goal updated.');
    });

    if (!successful) {
      this.error.set('Goal could not be updated.');
    }
  }

  private async loadGoal(): Promise<void> {
    try {
      const response = await this.goals.current();
      this.goal.set(response);
      this.model.set({ targetBooks: response.targetBooks });
    } catch {
      this.error.set('Goal could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
