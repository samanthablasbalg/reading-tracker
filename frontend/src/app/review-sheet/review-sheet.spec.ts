import { render, screen, fireEvent } from '@testing-library/angular';
import { Observable, of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReviewSheetComponent, ReviewSheetData } from './review-sheet';
import { EngagementService } from '../engagement.service';

const baseData: ReviewSheetData = {
  engagementId: 'eng-1',
  title: 'Dune',
  cover_url: null,
  review: null,
};

type MockEngagementService = Pick<EngagementService, 'upsertReview' | 'reloadEngagements'>;

async function setup(
  dataOverrides: Partial<ReviewSheetData> = {},
  serviceOverrides: Record<string, unknown> = {},
) {
  const mockDialogRef = { close: vi.fn() };
  const mockEngagementService = {
    upsertReview: vi.fn(() => of({})),
    reloadEngagements: vi.fn(),
    ...serviceOverrides,
  } as unknown as MockEngagementService;

  await render(ReviewSheetComponent, {
    providers: [
      provideNoopAnimations(),
      { provide: MAT_DIALOG_DATA, useValue: { ...baseData, ...dataOverrides } },
      { provide: MatDialogRef, useValue: mockDialogRef },
      { provide: EngagementService, useValue: mockEngagementService },
    ],
  });

  return { mockDialogRef, mockEngagementService };
}

function selectOption(select: HTMLSelectElement, text: string): void {
  const option = Array.from(select.options).find((o) => o.text === text);
  if (!option) throw new Error(`Option "${text}" not found`);
  fireEvent.change(select, { target: { value: option.value } });
}

function wholeSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', {
    name: 'Whole number rating for Dune',
  }) as HTMLSelectElement;
}

function fractionSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: 'Fractional rating for Dune' }) as HTMLSelectElement;
}

function selectedText(select: HTMLSelectElement): string {
  return select.options[select.selectedIndex].text;
}

describe('ReviewSheetComponent', () => {
  it('renders the book title', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Dune' })).toBeTruthy();
  });

  it('does not render an image when cover_url is null', async () => {
    await setup();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders a cover image when cover_url is set', async () => {
    await setup({ cover_url: 'https://example.com/cover.jpg' });
    const img = screen.getByRole('img', { name: 'Dune cover' }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/cover.jpg');
  });

  // --- Rating selects ---

  it('whole select starts at — when there is no existing review', async () => {
    await setup();
    expect(selectedText(wholeSelect())).toBe('—');
  });

  it('fraction select is disabled when there is no existing review', async () => {
    await setup();
    expect(fractionSelect().disabled).toBe(true);
  });

  it('pre-fills whole and fraction from an existing rating', async () => {
    await setup({ review: { rating: '4.25', body: null } });
    expect(selectedText(wholeSelect())).toBe('4');
    expect(selectedText(fractionSelect())).toBe('25');
  });

  it('fraction select is enabled when an existing rating is pre-filled', async () => {
    await setup({ review: { rating: '3.00', body: null } });
    expect(fractionSelect().disabled).toBe(false);
  });

  it('whole select shows — when existing review has no rating', async () => {
    await setup({ review: { rating: null, body: 'Just a note.' } });
    expect(selectedText(wholeSelect())).toBe('—');
  });

  it('fraction select is disabled when existing review has no rating', async () => {
    await setup({ review: { rating: null, body: 'Just a note.' } });
    expect(fractionSelect().disabled).toBe(true);
  });

  it('enables fraction select when whole number is selected', async () => {
    await setup();
    selectOption(wholeSelect(), '3');
    expect(fractionSelect().disabled).toBe(false);
  });

  it('disables fraction select when whole is reset to —', async () => {
    await setup();
    selectOption(wholeSelect(), '3');
    selectOption(wholeSelect(), '—');
    expect(fractionSelect().disabled).toBe(true);
  });

  it('resets fraction to 00 when whole is changed to 5', async () => {
    await setup();
    selectOption(wholeSelect(), '4');
    selectOption(fractionSelect(), '75');
    selectOption(wholeSelect(), '5');
    expect(selectedText(fractionSelect())).toBe('00');
  });

  // --- Body ---

  it('pre-fills body from an existing review', async () => {
    await setup({ review: { rating: '4.00', body: 'Loved it.' } });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Loved it.');
  });

  it('body textarea is empty when existing review has no body', async () => {
    await setup({ review: { rating: '3.00', body: null } });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  // --- Save ---

  it('calls upsertReview with null rating when no whole number is selected', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save review for Dune' }));
    expect(mockEngagementService.upsertReview).toHaveBeenCalledWith('eng-1', null, null);
  });

  it('calls upsertReview with the combined rating', async () => {
    const { mockEngagementService } = await setup();
    selectOption(wholeSelect(), '4');
    selectOption(fractionSelect(), '25');
    fireEvent.click(screen.getByRole('button', { name: 'Save review for Dune' }));
    expect(mockEngagementService.upsertReview).toHaveBeenCalledWith('eng-1', 4.25, null);
  });

  it('calls upsertReview with body text when body is entered', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Great read.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save review for Dune' }));
    expect(mockEngagementService.upsertReview).toHaveBeenCalledWith('eng-1', null, 'Great read.');
  });

  it('treats whitespace-only body as null', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save review for Dune' }));
    expect(mockEngagementService.upsertReview).toHaveBeenCalledWith('eng-1', null, null);
  });

  it('reloads engagements and closes on save success', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save review for Dune' }));
    expect(mockEngagementService.reloadEngagements).toHaveBeenCalledOnce();
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
  });

  it('shows Saving… and disables the button while the request is in flight', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    await setup(
      {},
      {
        upsertReview: vi.fn(
          () =>
            new Observable((sub) => {
              promise.then(() => sub.next({}));
            }),
        ),
      },
    );
    const button = screen.getByRole('button', {
      name: 'Save review for Dune',
    }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.textContent).toContain('Saving…');
    expect(button.disabled).toBe(true);
    resolve();
  });

  it('shows an inline error and keeps the sheet open on save failure', async () => {
    const { mockDialogRef } = await setup(
      {},
      { upsertReview: vi.fn(() => throwError(() => new Error('server error'))) },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save review for Dune' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed to save');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('closes without saving when Cancel is clicked', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
    expect(mockEngagementService.upsertReview).not.toHaveBeenCalled();
  });
});
