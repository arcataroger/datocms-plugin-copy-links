import { connect, type DropdownAction } from "datocms-plugin-sdk";
import "datocms-react-ui/styles.css";
import ConfigScreen from "./entrypoints/ConfigScreen";
import { render } from "./utils/render";

const sessionKey = "datocms-plugin-copy-links";

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />);
  },

  fieldDropdownActions(field) {
    switch (field.attributes.field_type) {
      case "link":
        const singleLinkActions: DropdownAction[] = [
          {
            id: "copySingleLink",
            label: "Copy link",
            icon: "clipboard",
          },
          {
            id: "pasteSingleLink",
            label: "Paste link",
            icon: "paste",
          },
        ];

        return singleLinkActions;

      case "links":
        const multiLinkActions: DropdownAction[] = [
          {
            id: "copyMultiLinks",
            label: "Copy links",
            icon: "clipboard-list",
          },
          {
            id: "pasteMultiLinks",
            label: "Paste link(s)",
            icon: "paste",
          },
        ];

        return multiLinkActions;

      default:
        return [];
    }
  },
  async executeFieldDropdownAction(id, ctx) {
    const { formValues, fieldPath, setFieldValue, field } = ctx;
    const currentValue = formValues[fieldPath] as string | string[];

    switch (id) {
      case "copySingleLink":
      case "copyMultiLinks":
        if (!currentValue?.length) {
          await ctx.alert(
            `Nothing to copy. Field "${field.attributes.label}" is empty.`,
          );
          return;
        }
        try {
          const stringified = currentValue.toString(); // Becomes comma-separated IDs
          sessionStorage.setItem(sessionKey, stringified);
          const numberOfIds = stringified.split(",").length; // Length after split
          await ctx.notice(`Copied ${numberOfIds} link(s).`);
        } catch (e) {
          await ctx.alert(
            `Error copying link(s): ${e instanceof Error ? e.message : e}`,
          );
        }
        break;

      case "pasteSingleLink":
        try {
          const maybeLink = sessionStorage.getItem(sessionKey);

          if (!maybeLink) {
            throw new Error("There was nothing to paste.");
            break;
          }
          const arrayified = maybeLink.split(",");

          // If it's single-element array, go ahead and paste it
          if (arrayified.length === 1) {
            await setFieldValue(fieldPath, arrayified[0]);
            await ctx.notice(
              "Pasted the only link copied from a multi-link field.",
            );
            break;
          }

          // If the split string has more than one element, error out
          if (arrayified.length > 1) {
            throw new Error(
              "You cannot paste multiple links into a single-link field.",
            );
          }

          // Else continue as a normal string
          await setFieldValue(fieldPath, sessionStorage.getItem(sessionKey));
          await ctx.notice("Pasted 1 link.");
        } catch (e) {
          await ctx.alert(
            `Error pasting link: ${e instanceof Error ? e.message : e}`,
          );
        }
        break;

      case "pasteMultiLinks":
        try {
          const maybeLinks = sessionStorage.getItem(sessionKey);
          if (!maybeLinks) {
            await ctx.alert("There was nothing to paste.");
            break;
          }
          if (maybeLinks?.length) {
            const linksAsArray = maybeLinks.split(",");
            await setFieldValue(fieldPath, linksAsArray);
            await ctx.notice(`Pasted ${linksAsArray.length} link(s).`);
          } else {
            throw new Error("Unable to paste links; not sure why");
          }
        } catch (e) {
          await ctx.alert(
            `Error pasting link(s): ${e instanceof Error ? e.message : e}`,
          );
        }
        break;
    }
  },
});
