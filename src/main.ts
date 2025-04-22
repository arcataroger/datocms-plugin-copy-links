import { connect, type DropdownAction } from "datocms-plugin-sdk";

// Can be anything. We just use this to store data to the browser's session storage.
const SESSION_KEY = "datocms-plugin-copy-links";

connect({
  // This is what defines our  context menu
  // See https://www.datocms.com/docs/plugin-sdk/dropdown-actions
  fieldDropdownActions(field) {
    // We need to differentiate between single-link fields (strings) and multi-link fields (arrays)
    switch (field.attributes.field_type) {
      // Single-link fields
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

      // Multi-link fields
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

      // Ignore other field types
      default:
        return [];
    }
  },
  async executeFieldDropdownAction(actionId, ctx) {
    const { formValues, fieldPath, setFieldValue, field } = ctx;
    const currentValue = formValues[fieldPath] as string | string[];

    switch (actionId) {
      // Copying is easy, since we can just stringify.
      // string.toString() is still a string.
      // array.toString() becomes comma-separated string.
      case "copySingleLink":
      case "copyMultiLinks":
        // Exit early if nothing to copy
        if (!currentValue?.length) {
          await ctx.alert(
            `Nothing to copy. Field "${field.attributes.label}" is empty.`,
          );
          return;
        }

        // Wrap in try block just in case anything goes wrong with sessionStorage or anything else
        try {
          const stringified = currentValue.toString(); // Becomes comma-separated IDs
          sessionStorage.setItem(SESSION_KEY, stringified);
          const numberOfIds = stringified.split(",").length; // Length after split
          await ctx.notice(`Copied ${numberOfIds} link(s).`);
        } catch (e) {
          await ctx.alert(
            `Error copying link(s): ${e instanceof Error ? e.message : e}`,
          );
        }
        break;

      // When pasting a single link, we have to test its properties to know how to paste it
      case "pasteSingleLink":
        try {
          const maybeLink = sessionStorage.getItem(SESSION_KEY);

          // Exit early if empty
          if (!maybeLink) {
            throw new Error("There was nothing to paste.");
            break;
          }

          // Try to split it by commas
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
          await setFieldValue(fieldPath, sessionStorage.getItem(SESSION_KEY));
          await ctx.notice("Pasted 1 link.");
        } catch (e) {
          await ctx.alert(
            `Error pasting link: ${e instanceof Error ? e.message : e}`,
          );
        }
        break;

      // We can be a little more lenient with multi-link fields
      case "pasteMultiLinks":
        try {
          const maybeLinks = sessionStorage.getItem(SESSION_KEY);

          // Exit early if empty
          if (!maybeLinks) {
            await ctx.alert("There was nothing to paste.");
            break;
          }

          // Split it by comma and paste it.
          // Single IDs become an single-element array of that ID
          // Multiple IDs become properly split by comma
          if (maybeLinks?.length) {
            const linksAsArray = maybeLinks.split(",");
            const currentAndNewLinks = [...currentValue, ...linksAsArray];
            const uniqueLinks = Array.from(new Set(currentAndNewLinks));
            console.log("unique", uniqueLinks);
            console.log("current", currentValue);

            // Test to see if it's the same as what's already in the field
            if (
              uniqueLinks.length === currentValue.length &&
              JSON.stringify(uniqueLinks) === JSON.stringify(currentValue)
            ) {
              throw new Error("Field already has all the pasted links.");
            }

            await setFieldValue(fieldPath, uniqueLinks);
            await ctx.notice(
              `Pasted ${uniqueLinks.length - currentValue.length} new link(s).`,
            );
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
