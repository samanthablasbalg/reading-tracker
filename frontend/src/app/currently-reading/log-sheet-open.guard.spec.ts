import { logSheetOpenGuard } from './log-sheet-open.guard';
import { CurrentlyReadingComponent } from './currently-reading';

function mockComponent(open: boolean) {
  return {
    logSheetOpen: () => open,
    closeLogSheet: vi.fn(),
  } as unknown as CurrentlyReadingComponent;
}

describe('logSheetOpenGuard', () => {
  it('allows navigation when the log sheet is closed', () => {
    const component = mockComponent(false);

    const result = logSheetOpenGuard(component, {} as never, {} as never, {} as never);

    expect(result).toBe(true);
    expect(component.closeLogSheet).not.toHaveBeenCalled();
  });

  it('blocks navigation and closes the sheet when the log sheet is open', () => {
    const component = mockComponent(true);

    const result = logSheetOpenGuard(component, {} as never, {} as never, {} as never);

    expect(result).toBe(false);
    expect(component.closeLogSheet).toHaveBeenCalledOnce();
  });
});
