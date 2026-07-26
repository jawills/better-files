export class RefreshEvent extends CustomEvent {
  constructor() {
    super("lightning__refresh", {
      bubbles: true,
      composed: true
    });
  }
}
