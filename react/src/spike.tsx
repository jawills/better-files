import { mountView } from "./mount";
import { FixtureCard, type FixtureCardProps } from "./demo/fixture-card";
import "./styles.css";

export { mountFiles } from "./mount";
export { defaultSettings } from "./model";
export { fromSalesforceFile } from "./salesforce";
export function mountFixture(
  container: HTMLElement,
  props: FixtureCardProps = {}
) {
  return mountView(
    container,
    (next) => <FixtureCard key={next.scenario} {...next} />,
    props
  );
}
export { fileToBase64 } from "./upload";
