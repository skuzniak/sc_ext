/// <reference path='../../typings/es6-shim/es6-shim.d.ts'/>
/// <reference path='../../app/scripts.ts/sc_ext-common.ts'/>
'use strict';
declare var scSitecore: any;
declare var scForm: any;
declare var scContentEditor: any;

namespace SitecoreExtensions.Modules {
    export interface ISitecoreExtensionsModule {
        moduleName: string;
        description: string;

        canExecute(): boolean;
        initialize(): void;
    }

    export class ModuleBase {
        moduleName: string;
        description: string;
        constructor(name: string, description: string) {
            this.moduleName = name;
            this.description = description;
        }
    }
}

namespace SitecoreExtensions.Modules.DatabaseName {
    export class DatabaseNameModule extends ModuleBase implements ISitecoreExtensionsModule {
        constructor(name: string, description: string) {
            super(name, description);
        }

        adDbNameToHeader(dbName: string): void {
            var dbnameDiv = HTMLHelpers.createElement<HTMLDivElement>('div', { class: 'sc-ext-dbName' });
            dbnameDiv.innerText = dbName;
            document.querySelector('.sc-globalHeader-loginInfo').parentNode.appendChild(dbnameDiv);
        }

        canExecute(): boolean {
            return SitecoreExtensions.Context.Database() != null && document.querySelector('.sc-globalHeader-loginInfo') != null;
        }

        initialize(): void {
            var dbName = SitecoreExtensions.Context.Database();
            if (dbName != null) {
                this.adDbNameToHeader(dbName.toUpperCase());
            }
        }
    }
}

namespace SitecoreExtensions.Modules.DatabaseColor {
    import Dictionary = SitecoreExtensions.Types.Dictionary
    import IDictionary = SitecoreExtensions.Types.IDictionary

    export class DatabaseColorModule extends ModuleBase implements ISitecoreExtensionsModule {
        coloursMapping: IDictionary;

        constructor(name: string, description: string) {
            super(name, description);
            this.coloursMapping = new Dictionary([
                { key: 'WEB', value: '#DC291E' },
            ]);
        }

        changeheaderColor(dbName: string): void {
            if (this.coloursMapping.containsKey(dbName)) {
                var header = document.getElementsByClassName('sc-globalHeader-content')[0];
                header.setAttribute("style", "background-color: " + this.coloursMapping[dbName] + ";")
            }
        }

        canExecute(): boolean {
            return SitecoreExtensions.Context.Database() != null && document.querySelector('.sc-globalHeader-content') != null;
        }

        initialize(): void {
            var dbName = SitecoreExtensions.Context.Database();
            if (dbName != null) {
                this.changeheaderColor(dbName.toUpperCase());
            }
        }
    }
}

namespace SitecoreExtensions.Modules.SectionSwitches {
    export class SectionSwitchesModule extends ModuleBase implements ISitecoreExtensionsModule {
        sectionSwitchButtonClassName: string;
        constructor(name: string, description: string) {
            super(name, description);
            this.sectionSwitchButtonClassName = 'scEButton';
        }

        closeOpenedSections() {
            HTMLHelpers.triggerEventOnSelector('.scEditorSectionCaptionExpanded .scEditorSectionCaptionGlyph', 'click');
        };

        openClosedSections() {
            HTMLHelpers.triggerEventOnSelector('.scEditorSectionCaptionCollapsed .scEditorSectionCaptionGlyph', 'click');
        };

        createTabControlButton(text: string, callback: { (e: MouseEvent): any }): HTMLAnchorElement {
            var span = HTMLHelpers.createElement<HTMLSpanElement>('span', {});
            span.innerText = text
            var link = HTMLHelpers.createElement<HTMLAnchorElement>('a', {
                href: '#',
                class: 'scEditorHeaderNavigator scEditorHeaderButton scButton ' + this.sectionSwitchButtonClassName
            });
            link.onclick = callback;
            link.appendChild(span);
            return link;
        }

        private insertButtons(): void {
            var btnCollapse = this.createTabControlButton('Collapse', this.closeOpenedSections)
            var btnExpand = this.createTabControlButton('Expand', this.openClosedSections)

            var controlsTab = document.querySelector('.scEditorTabControlsTab5');
            controlsTab.insertBefore(btnCollapse, controlsTab.firstChild);
            controlsTab.insertBefore(btnExpand, controlsTab.firstChild);
        };

        buttonsExists(): boolean {
            return document.getElementsByClassName(this.sectionSwitchButtonClassName).length > 0
        }

        refreshButtons(): void {
            if (!this.buttonsExists()) {
                this.insertButtons();
            }
        }

        addTreeNodeHandlers(className: string): void {
            var nodes = document.getElementsByClassName(className);
            for (var i = 0; i < nodes.length; i++) {
                nodes[i].addEventListener('click', (evt) => {
                    setTimeout(() => {
                        this.refreshButtons();
                    }, 10);
                });
            }
        }

        canExecute(): boolean {
            return SitecoreExtensions.Context.Location() == Location.ContentEditor;
        }

        initialize(): void {
            window.addEventListener('load', () => this.insertButtons());
            this.addTreeNodeHandlers('scContentTree');
            HTMLHelpers.addProxy(scSitecore, 'postEvent', () => { this.refreshButtons(); });
            HTMLHelpers.addProxy(scForm, 'invoke', () => { this.refreshButtons(); });
        }
    }

    import ICommandsProvider = SitecoreExtensions.Modules.Launcher.Providers.ICommandsProvider;
    import ICommand = SitecoreExtensions.Modules.Launcher.ICommand;
    export class SectionSwitchesCommandsProvider implements ICommandsProvider {
        commands: ICommand[];
        constructor() {
            this.commands = new Array<ICommand>();
            this.initCommands();
        }

        initCommands(): void {
            var cmd1: ICommand = {
                id: 0,
                name: 'Open sections',
                description: 'Open all closed sections',
                execute: SectionSwitchesModule.prototype.openClosedSections,
                canExecute: () => { return SitecoreExtensions.Context.Location() == Location.ContentEditor; }
            };
            var cmd2: ICommand = {
                id: 0,
                name: 'Close sections',
                description: 'Close all opened sections',
                execute: SectionSwitchesModule.prototype.closeOpenedSections,
                canExecute: () => { return SitecoreExtensions.Context.Location() == Location.ContentEditor; }
            };
            this.commands.push(cmd1);
            this.commands.push(cmd2);
        }

        getCommands(): ICommand[] {
            return this.commands;
        }
    }
}

namespace SitecoreExtensions.Modules.Launcher {
    export interface ICommand {
        id: number;
        name: string;
        description: string;
        execute: Function;
        canExecute: Function
    }

    class SearchResult {
        command: ICommand
        score: number;
        term: string;
        highlightedTerm: string;
    }

    export namespace Providers {
        declare var scForm: any;

        export interface ICommandsProvider {
            getCommands(): ICommand[]
        }

        export class ContentEditorRibbonCommandsProvider implements ICommandsProvider {
            commands: ICommand[];

            constructor() {
                this.commands = Array<ICommand>();
                this.createCommands();
            }
            getCommands(): ICommand[] {
                return this.commands;
            }

            createCommands(): void {
                var canExecute = () => { return SitecoreExtensions.Context.Location() == Location.ContentEditor; }

                //Home
                this.addCommand('Save', 'Save any changes. (Ctrl+S)', () => { scForm.invoke('contenteditor:save', 'click'); }, canExecute)
                this.addCommand('Edit', 'Lock or unlock the item for editing. (F8)', () => { scForm.invoke('contenteditor:edit'); }, canExecute)
                this.addCommand('Insert from template', 'Insert from template', () => { scForm.postEvent(this, 'click', 'item:addfromtemplate(id=' + SitecoreExtensions.Context.ItemID() + ')'); }, canExecute);
                this.addCommand('Duplicate item', 'Duplicate item', () => { scForm.postEvent(this, 'click', 'item:duplicate'); }, canExecute)
                this.addCommand('Clone item', 'Clone item', () => { scForm.postEvent(this, 'click', 'item:clone'); }, canExecute)
                this.addCommand('Copy to', 'Copy the item to another location.', () => { scForm.postEvent(this, 'click', 'item:copyto'); }, canExecute);
                this.addCommand('Move to', 'Move the item to another location.', () => { scForm.postEvent(this, 'click', 'item:moveto'); }, canExecute);
                this.addCommand('Delete', 'Delete the item.', () => { scForm.invoke('item:delete(id=' + SitecoreExtensions.Context.ItemID() + ')'); }, canExecute)
                this.addCommand('Delete children', 'Delete current item subitems.', () => { scForm.postEvent(this, 'click', 'item:deletechildren(id=)'); }, canExecute);
                this.addCommand('Rename', 'Rename the item key. (F2)', () => { scForm.postEvent(this, 'click', 'item:rename'); }, canExecute);
                this.addCommand('Display name', 'Change the language-specific name.', () => { scForm.postEvent(this, 'click', 'item:setdisplayname'); }, canExecute);
                this.addCommand('Move Up', 'Move the item one step up in the Content Tree. (Ctrl+Shift+Alt+Up)', () => { scForm.postEvent(this, 'click', 'item:moveup'); }, canExecute);
                this.addCommand('Move Down', 'Move the item one step down in the Content Tree. (Ctrl+Shift+Alt+Down)', () => { scForm.postEvent(this, 'click', 'item:movedown'); }, canExecute);
                this.addCommand('Move First', 'Move the item to the first place at this level in the Content Tree.', () => { scForm.postEvent(this, 'click', 'item:movefirst'); }, canExecute);
                this.addCommand('Move Last', 'Move the item to the last place at this level in the Content Tree.', () => { scForm.postEvent(this, 'click', 'item:movelast'); }, canExecute);

                //Navigate
                this.addCommand('Open', 'Open an item.', () => { scForm.invoke('item:open'); }, canExecute);
                this.addCommand('Navigate: Back', 'Go to the previously selected item.', () => { scForm.invoke('contenteditor:back', 'click'); }, canExecute)
                this.addCommand('Navigate: Forward', 'Go to the next selected item.', () => { scForm.invoke('contenteditor:forward', 'click'); }, canExecute)
                this.addCommand('Navigate: Up', 'Go to the parent item.', () => { scForm.invoke('contenteditor:up', 'click'); }, canExecute)
                this.addCommand('Navigate: Home', 'Go to your home item. (Ctrl+Shift+Home)', () => { scForm.invoke('contenteditor:home', 'click'); }, canExecute)
                this.addCommand('Add to favorites', 'Add current item to favourites', () => { scForm.postEvent(this, 'click', 'favorites:add(id=' + SitecoreExtensions.Context.ItemID() + ')'); }, canExecute);
                this.addCommand('Organize', 'Organize favorites', () => { scForm.postEvent(this, 'click', 'favorites:organize'); }, canExecute);
                this.addCommand('Search', 'Open the Search application. (Ctrl+Shift+F)', () => { scForm.invoke('shell:search', 'click'); }, canExecute)

                //Review
                this.addCommand('Spellcheck', 'Run the spellcheck on all text and HTML fields in th selected item.', () => { scForm.invoke('contenteditor:spellcheck', 'click'); }, canExecute)
                this.addCommand('Validate Markup', 'Send all HTML fields to the W3C HTML Validator.', () => { scForm.invoke('contenteditor:validatemarkup', 'click'); }, canExecute)
                this.addCommand('Validation', 'View the validation results. (F7)', () => { scForm.invoke('contenteditor:showvalidationresult', 'click'); }, canExecute)
                this.addCommand('My items', 'View the items you have locked.', () => { scForm.invoke('item:myitems', 'click'); }, canExecute)
                this.addCommand('Set reminder', 'Set reminder', () => { scForm.postEvent(this, 'click', 'item:reminderset(id=' + SitecoreExtensions.Context.ItemID() + ')'); }, canExecute)
                this.addCommand('Clear reminder', 'Clear reminder', () => { scForm.postEvent(this, 'click', 'item:reminderclear(id=' + SitecoreExtensions.Context.ItemID() + ')'); }, canExecute)
                this.addCommand('Archive item now', 'Archive item now', () => { scForm.postEvent(this, 'click', 'item:archiveitem(id=' + SitecoreExtensions.Context.ItemID() + ')'); }, canExecute)
                this.addCommand('Archive version now', 'Archive version now', () => { scForm.postEvent(this, 'click', 'item:archiveversion(id=' + SitecoreExtensions.Context.ItemID() + ', la=en, vs=1)'); }, canExecute)
                this.addCommand('Set archive date', 'Set archive date', () => { scForm.postEvent(this, 'click', 'item:archivedateset(id=' + SitecoreExtensions.Context.ItemID() + ')'); }, canExecute)

                //Analyze
                this.addCommand('Goals', 'Associate goals with the selected item.', () => { scForm.invoke('analytics:opengoals', 'click'); }, canExecute)
                this.addCommand('Attributes', 'Associate attributes to the selected item.', () => { scForm.invoke('analytics:opentrackingfield', 'click'); }, canExecute)
                this.addCommand('Tracking Details', 'View the attributes assigned to the selected item.', () => { scForm.invoke('analytics:viewtrackingdetails', 'click'); }, canExecute)
                this.addCommand('Page Analyzer', 'Page Analyzer', () => { scForm.invoke('pathanalyzer:open-page-analyzer', 'click'); }, canExecute)
                this.addCommand('Reports', 'Run an item report on the selected item.', () => { scForm.invoke('analytics:authoringfeedback', 'click'); }, canExecute)

                //Publish
                this.addCommand('Change Publishing Settings', 'Set up the publishing settings.', () => { scForm.invoke('item:setpublishing', 'click'); }, canExecute)
                this.addCommand('Publish Now', 'Publish the item in all languages to all publishing targets.', () => { scForm.invoke('item:publishnow(related=1,subitems=0,smart=1)'); }, canExecute)
                this.addCommand('Publish Item', 'Publish item', () => { scForm.postEvent(this, 'click', 'item:publish(id=)'); }, canExecute)
                this.addCommand('Publish Site', 'Publish site', () => { scForm.postEvent(this, 'click', 'system:publish'); }, canExecute)
                this.addCommand('Experience Editor', 'Start the Experience Editor.', () => { scForm.postEvent(this, 'click', 'webedit:openexperienceeditor'); }, canExecute)
                this.addCommand('Preview', 'Start the Preview mode.', () => { scForm.postEvent(this, 'click', 'item:preview'); }, canExecute)
                this.addCommand('Publishing viewer', 'View the publishing dates of each version.', () => { scForm.postEvent(this, 'click', 'item:publishingviewer(id=)'); }, canExecute)
                this.addCommand('Messages', 'Create, edit, and post a message on a target ntwork.', () => { scForm.invoke('social:dialog:show', 'click'); }, canExecute)

                //Versions
                this.addCommand('Reset Fields', 'Reset the field values.', () => { scForm.invoke('item:resetfields', 'click'); }, canExecute)
                this.addCommand('Add Version', 'Add a version of the selected item.', () => { scForm.postEvent(this, 'click', 'item:addversion(id=)'); }, canExecute)
                this.addCommand('Compare Versions', 'Compare the versions of the selected item.', () => { scForm.postEvent(this, 'click', 'item:compareversions'); }, canExecute)
                this.addCommand('Remove Version', 'Remove the item version that is currently displayed.', () => { scForm.postEvent(this, 'click', 'item:deleteversion'); }, canExecute)
                this.addCommand('Remove all versions', 'Remove all versions', () => { scForm.postEvent(this, 'click', 'item:removelanguage'); }, canExecute)
                this.addCommand('Translate', 'Show the translate mode.', () => { scForm.postRequest('', '', '', 'Translate_Click'); }, canExecute)

                //Configure
                this.addCommand('Help', 'Write help texts.', () => { scForm.postEvent(this, 'click', 'item:sethelp'); }, canExecute)
                this.addCommand('Editors', 'Configure the custom editors.', () => { scForm.postEvent(this, 'click', 'item:setcustomeditors'); }, canExecute)
                this.addCommand('Tree node style', 'Define the appearance in the content tree.', () => { scForm.postEvent(this, 'click', 'item:settreenodestyle'); }, canExecute)
                this.addCommand('Contextual tab', 'Specify a contextual tab in the ribbon.', () => { scForm.postEvent(this, 'click', 'item:setribbon'); }, canExecute)
                this.addCommand('Context menu', 'Specify the context menu.', () => { scForm.postEvent(this, 'click', 'item:setcontextmenu'); }, canExecute)
                this.addCommand('Bucket', 'Convert this item into an ite bucket. (Ctrl+Shift+B)', () => { scForm.invoke('item:bucket', 'click'); }, canExecute)
                this.addCommand('Revert', 'Revert this item bucket to a normal folder. (Ctrl+Shift+D)', () => { scForm.invoke('item:unbucket', 'click'); }, canExecute)
                this.addCommand('Sync', 'Synchronize this item bucket. (Ctrl+Shift+U)', () => { scForm.invoke('item:syncbucket', 'click'); }, canExecute)
                this.addCommand('Bucketable:Current item', 'Allow the current item to be stored as an unstructured item in an item bucket.', () => { scForm.postEvent(this, 'click', 'item:bucketable'); }, canExecute)
                this.addCommand('Bucketable:Standard values', 'Allow all items based on the Sample Item to be stored as an unstructured item in a bucket.', () => { scForm.postEvent(this, 'click', 'template:bucketable'); }, canExecute)
                this.addCommand('Set Masters', 'Assign insert options', () => { scForm.postEvent(this, 'click', 'item:setmasters'); }, canExecute)
                this.addCommand('Reset', 'Reset to the insert options defined on the template.', () => { scForm.postEvent(this, 'click', 'masters:reset'); }, canExecute)
                this.addCommand('Change Template', 'Change to another template.', () => { scForm.postEvent(this, 'click', 'item:changetemplate'); }, canExecute)
                this.addCommand('Edit Template', 'Open the Template Editor.', () => { scForm.postEvent(this, 'click', 'shell:edittemplate'); }, canExecute)
                this.addCommand('Hide Item', 'Mark the item as hidden or visible.', () => { scForm.postEvent(this, 'click', 'item:togglehidden'); }, canExecute)
                this.addCommand('Protect Item', 'Protect or unprotect the item from changes. (Ctrl+Shift+Alt+L)', () => { scForm.postEvent(this, 'click', 'item:togglereadonly'); }, canExecute)

                //Presentation
                this.addCommand('Layout Details', 'View and edit the layout details for the selected tem.', () => { scForm.invoke('item:setlayoutdetails', 'click'); }, canExecute)
                this.addCommand('Reset Layout', 'Reset the layout details to the settings defined n the template level.', () => { scForm.invoke('pagedesigner:reset', 'click'); }, canExecute)
                this.addCommand('Preview', 'Preview of the selected item presentation.', () => { scForm.invoke('contenteditor:preview', 'click'); }, canExecute)
                this.addCommand('Screenshots', 'Take screenshots of your webpages.', () => { scForm.invoke('contenteditor:pagepreviews(width=90%,height=90%)', 'click'); }, canExecute)
                this.addCommand('Aliases', 'Assign URL aliases.', () => { scForm.invoke('item:setaliases', 'click'); }, canExecute)
                this.addCommand('Set Feed Presentation', 'Set up the design of RSS feed for the selected item.', () => { scForm.invoke('item:setfeedpresentation', 'click'); }, canExecute)

                //Security
                this.addCommand('Remove Inherit', 'Security Preset: Remove Inherit', () => { scForm.invoke('item:securitypreset(preset={74A590B5-CC32-4777-8ADE-7369C753B7FF})'); }, canExecute)
                this.addCommand('Require Login', 'Security Preset: Require Login', () => { scForm.invoke('item:securitypreset(preset={506FC890-44A4-4037-8696-4934CB75C00A})'); }, canExecute)
                this.addCommand('Assign', 'Assign security rights for the selected item.', () => { scForm.invoke('item:openitemsecurityeditor', 'click'); }, canExecute)
                this.addCommand('Security Details', 'View assigned security rights for the selected item.', () => { scForm.invoke('contenteditor:opensecurity', 'click'); }, canExecute)
                this.addCommand('Change', 'Change of the ownership', () => { scForm.invoke('item:setowner', 'click'); }, canExecute)
                this.addCommand('Access Viewer', 'Open the Access Viewer.', () => { scForm.postEvent(this, 'click', 'shell:accessviewer'); }, canExecute)
                this.addCommand('User Manager', 'Open the User Manager.', () => { scForm.postEvent(this, 'click', 'shell:usermanager'); }, canExecute)

                //View
                this.addCommand('Content tree', 'Show or hide the content tree.', () => { scForm.postEvent(this, 'click', 'javascript:scContent.toggleFolders()'); }, canExecute);
                this.addCommand('Entire tree', 'Show or hide all the sections in the content tree.', () => { scForm.postEvent(this, 'click', 'EntireTree_Click'); }, canExecute);
                this.addCommand('Hidden items', 'Show or hide items marked with the Hidden attribute.', () => { scForm.postEvent(this, 'click', 'HiddenItems_Click'); }, canExecute);
                this.addCommand('Standard fields', 'Show or hide fields from the Standard Template (system fields). (Ctrl+Shift+Alt+T)', () => { scForm.postEvent(this, 'click', 'StandardFields_Click'); }, canExecute);
                this.addCommand('Raw values', 'Show field values as input boxes or as raw values. (Ctrl+Shift+Alt+R)', () => { scForm.postEvent(document, 'click', 'RawValues_Click'); }, canExecute);
                this.addCommand('Buckets', 'Show or hide the bucket repository items', () => { scForm.postEvent(this, 'click', 'contenteditor:togglebucketitems'); }, canExecute);

                //My Toolbar                
                this.addCommand('Customize', 'Customize My Toolbar', () => { scForm.invoke('ribbon:customize', 'click'); }, canExecute)

                //Developer
                this.addCommand('Create Template', 'Create a new template', () => { scForm.postEvent(this, 'click', 'templates:new'); }, canExecute)
                this.addCommand('Go to Master', 'Go to the first branch', () => { scForm.postEvent(this, 'click', 'item:gotomaster'); }, canExecute)
                this.addCommand('Go to Template', 'Go to the template', () => { scForm.postEvent(this, 'click', 'item:gototemplate'); }, canExecute)
                this.addCommand('Serialize item', 'Serialize the item to the file system', () => { scForm.postEvent(this, 'click', 'itemsync:dumpitem'); }, canExecute)
                this.addCommand('Serialize tree', 'Serialize the item and subitems to the file system', () => { scForm.postEvent(this, 'click', 'itemsync:dumptree'); }, canExecute)
                this.addCommand('Update item', 'Update the item from the file system', () => { scForm.postEvent(this, 'click', 'itemsync:loaditem'); }, canExecute)
                this.addCommand('Revert item', 'Revert the item from the file system', () => { scForm.postEvent(this, 'click', 'itemsync:loaditem(revert=1)'); }, canExecute)
                this.addCommand('Update tree', 'Update the item and subitems from the file system', () => { scForm.postEvent(this, 'click', 'itemsync:loadtree'); }, canExecute)
                this.addCommand('Revert tree', 'Revert the item and subitems from the file system', () => { scForm.postEvent(this, 'click', 'itemsync:loadtree(revert=1)'); }, canExecute)
                this.addCommand('Update database', 'Update the database from the file system. Not removing local modifications', () => { scForm.postEvent(this, 'click', 'itemsync:loaddatabase'); }, canExecute)
                this.addCommand('Revert database', 'Revert the database from the file system', () => { scForm.postEvent(this, 'click', 'itemsync:loaddatabase(revert=1)'); }, canExecute)
                this.addCommand('Rebuild all', 'Rebuild all the indexes.', () => { scForm.invoke('indexing:rebuildall', 'click'); }, canExecute)
                this.addCommand('Re-Index Tree', 'Rebuild the index for this item and its desendants.', () => { scForm.invoke('indexing:refreshtree', 'click'); }, canExecute)
            }

            addCommand(name: string, description: string, execute: Function, canExecute: Function): void {
                var cmd: ICommand = {
                    id: 0,
                    name: name,
                    description: description,
                    execute: execute,
                    canExecute: canExecute
                };
                this.commands.push(cmd)
            }
        }

        class ShortcutCommand implements ICommand {
            id: number;
            name: string;
            description: string;
            aspx: string;

            constructor(name, description, aspx) {
                this.id = 0;
                this.aspx = aspx;
                this.name = name;
                this.description = description;
            }

            navigate(aspx: string): void {
                var location = window.location.origin + '/sitecore/admin/' + aspx + '.aspx'
                document.location.href = location;
            }

            canExecute(): boolean {
                return true;
            }

            execute(): void {
                this.navigate(this.aspx)
            }
        }

        export class AdminShortcutsCommandsProvider implements ICommandsProvider {
            commands: ICommand[];

            constructor() {
                this.commands = Array<ICommand>();
                this.createCommands();
            }

            createCommands(): void {
                this.addCommand('Administration Tools.aspx', 'List of all administrative tools', 'default');
                this.addCommand('Cache.aspx', 'Caches overview.', 'cache');
                this.addCommand('DB Browser.aspx', 'The interface for various item manipulations.', 'dbbrowser');
                this.addCommand('Database Cleanup.aspx', 'Perform various cleanup operations on specific databases.', 'DbCleanup');
                this.addCommand('EventQueue Statistics.aspx', 'Overview of the EventQueue processing.', 'EventQueueStats');
                this.addCommand('Fill DB - Sitecore Item Generator.aspx', 'Fill the specific database with dummy items.', 'FillDB');
                this.addCommand('Jobs Viewer.aspx', 'Overview of jobs execution.', 'Jobs');
                this.addCommand('Ling Scratch Pad.aspx', 'Execute custom search code.', 'LinqScratchPad');
                this.addCommand('Package Item.aspx', 'Package specific items with their dependencies.', 'PackageItem');
                this.addCommand('Pipeline Profiler.aspx', 'Pipelines execution timings.', 'pipelines');
                this.addCommand('PublishQueue statistics.aspx', 'Overview of the PublishQueue processing.', 'PublishQueueStats');
                this.addCommand('Raw Search.aspx', 'Search for the specific string in database or on the file system.', 'RawSearch');
                this.addCommand('Remove Broken Links.aspx', 'Remove broken links from the specific database.', 'RemoveBrokenLinks');
                this.addCommand('Restore Item.aspx', 'Restore items from archive.', 'restore');
                this.addCommand('Security Tools.aspx', 'Various login and user management features.', 'SecurityTools');
                this.addCommand('Serialization.aspx', 'Serialize and revert databases', 'serialization');
                this.addCommand('Set Application Center Endpoint.aspx', 'Change Application Center endpoint address', 'SetSACEndpoint');
                this.addCommand('Show Config.aspx', 'Merge configuration files.', 'ShowConfig');
                this.addCommand('Sql Shell.aspx', 'Execute sql sripts using the specific connection strings.', 'SqlShell');
                this.addCommand('Rendering statistics.aspx', 'Overview of renderings performance', 'stats');
                this.addCommand('Unlock Admin.aspx', 'Unlock Admin user.', 'unlock_admin');
                this.addCommand('Update Installation Wizard.aspx', 'Install Sitecore updates.', 'UpdateInstallationWizard');
                this.addCommand('User Info.aspx', 'Logged in user details.', 'UserInfo');
            }


            addCommand(name: string, description: string, aspx: string): void {
                this.commands.push(new ShortcutCommand(name, description, aspx))
            }

            getCommands(): ICommand[] {
                return this.commands;
            }
        }
    }

    export class LauncherModule extends ModuleBase implements ISitecoreExtensionsModule {
        modalElement: HTMLDivElement;
        searchResultsElement: HTMLUListElement;
        searchBoxElement: HTMLInputElement;
        selectedCommand: NodeListOf<HTMLLIElement>;
        launcherOptions: any;
        commands: ICommand[];

        constructor(name: string, description: string) {
            super(name, description);
            this.commands = new Array<ICommand>();
            this.launcherOptions = {
                searchResultsCount: 8,
                shortcuts: {
                    show: 32,
                    hide: 27,
                    selectNextResult: 40,
                    selectPrevResult: 38,
                    executeCommand: 13
                }
            };

            this.registerModuleCommands();
        }

        private registerModuleCommands(): void {
            this.registerProviderCommands(new Providers.ContentEditorRibbonCommandsProvider());
            this.registerProviderCommands(new Providers.AdminShortcutsCommandsProvider());
        }

        registerProviderCommands(provider: Providers.ICommandsProvider): void {
            this.registerCommands(provider.getCommands());
        }

        registerCommands(commands: ICommand[]): void {
            commands.forEach(cmd => { this.registerCommand(cmd); });
        }

        registerCommand(command: ICommand): void {
            command.id = this.commands.length + 1;
            this.commands.push(command);
        }

        showLauncher(): void {
            this.modalElement.style.display = 'block';
            this.searchBoxElement.focus();
        }

        hideLauncher(): void {
            this.modalElement.style.display = 'none';
            this.searchBoxElement.value = '';
            this.clearResults();
        }

        private appendResults(sortedResults: SearchResult[]): void {
            this.clearResults();
            if (sortedResults.length > 0) {
                for (var i = 0; i < sortedResults.length && i < this.launcherOptions.searchResultsCount; i++) {
                    var li = this.buildCommandHtml(sortedResults[i]);
                    this.searchResultsElement.appendChild(li);
                }

                if (this.searchResultsElement.className !== 'term-list') {
                    this.searchResultsElement.className = 'term-list';
                }
            }
        }

        clearResults(): void {
            this.searchResultsElement.className = 'term-list hidden';
            this.searchResultsElement.innerHTML = '';
        }

        private buildCommandHtml(sr: SearchResult): HTMLLIElement {
            var li = HTMLHelpers.createElement<HTMLLIElement>('li', null, { id: sr.command.id });
            var spanName = HTMLHelpers.createElement<HTMLSpanElement>('span', { class: 'command-name' });
            spanName.innerHTML = sr.highlightedTerm;
            var spanDescription = HTMLHelpers.createElement<HTMLSpanElement>('span', { class: 'command-description' });
            spanDescription.innerText = sr.command.description;

            li.appendChild(spanName);
            li.appendChild(spanDescription);

            li.onclick = (e) => {
                var element = <Element>e.srcElement;
                if (element.tagName != 'LI') {
                    element = <Element>element.parentNode;
                }
                this.changeSelectedCommand(element);
                this.searchBoxElement.focus();
            };
            li.ondblclick = _ => this.executeSelectedCommand();
            return li;
        }

        injectlauncherHtml(): void {
            var modal = HTMLHelpers.createElement<HTMLDivElement>('div', { class: 'launcher-modal', id: 'sc-ext-modal' });
            var div = HTMLHelpers.createElement<HTMLDivElement>('div', { class: 'launcher-modal-content' });
            var input = HTMLHelpers.createElement<HTMLInputElement>('input', { class: 'search-field', id: 'sc-ext-searchBox' });

            var ul = HTMLHelpers.createElement<HTMLUListElement>('ul', { class: 'term-list hidden', id: 'sc-ext-searchResults' });
            input.onkeyup = (e) => this.inputKeyUpEvent(e);
            div.appendChild(input);
            div.appendChild(ul);
            window.onclick = (e) => this.windowClickEvent(e);
            modal.appendChild(div);
            document.querySelector('body').appendChild(modal);
        }

        registerGlobalShortcuts(): void {
            document.onkeydown = (evt: KeyboardEvent) => {
                evt = (evt != null ? evt : <KeyboardEvent>window.event);
                switch (evt.which || evt.keyCode) {
                    case this.launcherOptions.shortcuts.show: {
                        if (evt.ctrlKey) {
                            this.showLauncher();
                            break;
                        }
                        return;
                    }
                    case this.launcherOptions.shortcuts.hide: {
                        if (event.target == this.searchBoxElement) {
                            this.hideLauncher();
                        }
                        break;
                    }
                    default: return;
                }
                evt.preventDefault();
            };
        }

        addFlowConditionForKeyDownEvent(): void {
            HTMLHelpers.addFlowConditionToEvent(scSitecore, 'onKeyDown', (evt: KeyboardEvent) => {
                evt = (evt != null ? evt : <KeyboardEvent>window.event);
                return evt.srcElement.id != 'sc-ext-searchBox';
            });
        }

        executeSelectedCommand(): void {
            var command = <ICommand>this.commands.find((cmd: ICommand) => {
                var selectedComandId = parseInt((<HTMLLIElement>this.selectedCommand[0]).dataset['id'])
                return cmd.id == selectedComandId
            });
            command.execute();
            this.hideLauncher()
        }

        inputKeyUpEvent(evt: KeyboardEvent): void {
            if (evt.keyCode == this.launcherOptions.shortcuts.executeCommand && this.selectedCommand[0]) {
                this.executeSelectedCommand();
                return;
            }
            if (evt.keyCode == this.launcherOptions.shortcuts.selectPrevResult || evt.keyCode == this.launcherOptions.shortcuts.selectNextResult) {
                this.commandSelectionEvent(evt);
            } else {
                var results = this.search(this.searchBoxElement.value);
                this.appendResults(results);

                if (this.searchResultsElement.children.length > 0) {
                    (<HTMLLIElement>this.searchResultsElement.firstChild).setAttribute('class', 'selected');
                }
            }
        }

        windowClickEvent(evt: MouseEvent): void {
            if (evt.target == this.modalElement) {
                this.modalElement.style.display = 'none';
                this.searchBoxElement.value = ''
            }
        }

        changeSelectedCommand(newSelected): void {
            var oldSelected = <HTMLLIElement>this.searchResultsElement.querySelector('.selected');
            oldSelected.removeAttribute('class');
            newSelected.setAttribute('class', 'selected');
        }

        commandSelectionEvent(evt: KeyboardEvent): void {
            var commands = this.searchResultsElement.querySelectorAll('li')
            if (commands.length > 0) {
                var selected = <HTMLLIElement>this.searchResultsElement.querySelector('.selected');
                if (selected == undefined) selected = <HTMLLIElement>this.searchResultsElement.querySelector('li')

                if (evt.keyCode == this.launcherOptions.shortcuts.selectPrevResult && commands[0] != selected) {
                    if (selected.className == 'selected') {
                        this.changeSelectedCommand(selected.previousSibling)
                    }
                }

                if (evt.keyCode == this.launcherOptions.shortcuts.selectNextResult && commands.length != 0) {
                    if (selected.className == 'selected' && commands[commands.length - 1] !== selected) {
                        this.changeSelectedCommand(selected.nextSibling)
                    }
                }
            }
        }

        private canBeExecuted(command: ICommand, index: number, array: ICommand[]): boolean {
            return command.canExecute();
        }

        private search(query: string): SearchResult[] {
            var results = new Array<SearchResult>();
            var i;

            if (query === '') {
                return [];
            }

            var availableCommands = this.commands.filter(this.canBeExecuted);

            for (i = 0; i < availableCommands.length; i++) {
                var cmd = availableCommands[i];
                var f = Libraries['fuzzy'](cmd.name, query);
                results[i] = <SearchResult>{
                    command: cmd,
                    score: f.score,
                    term: f.term,
                    highlightedTerm: f.highlightedTerm,
                }
            }
            results.sort(Libraries['fuzzy'].matchComparator);
            return results.slice(0, this.launcherOptions.searchResultsCount);
        }

        canExecute(): boolean {
            return true;
        }

        initialize(): void {
            this.injectlauncherHtml();
            this.registerGlobalShortcuts();
            if (SitecoreExtensions.Context.Location() == Location.ContentEditor) {
                this.addFlowConditionForKeyDownEvent();
            }
            this.modalElement = <HTMLDivElement>document.getElementById('sc-ext-modal');
            this.searchBoxElement = <HTMLInputElement>document.getElementById('sc-ext-searchBox')
            this.searchResultsElement = <HTMLUListElement>document.getElementById('sc-ext-searchResults')
            this.selectedCommand = document.getElementsByClassName('selected') as NodeListOf<HTMLLIElement>;

            Libraries['fuzzy'].highlighting.before = "<span class='term'>";
            Libraries['fuzzy'].highlighting.after = '</span>';
        }
    }
}

namespace SitecoreExtensions.Modules.LastLocation {
    import ICommandsProvider = SitecoreExtensions.Modules.Launcher.Providers.ICommandsProvider;
    import ICommand = SitecoreExtensions.Modules.Launcher.ICommand;
    declare var scForm: any;

    class LastLocationStore {
        private static LocalStorageKey: string = "sc_ext::last_item";

        public static saveLastItemId(id: string): void {
            localStorage.setItem(this.LocalStorageKey, id);
        }

        public static loadLastItemId(): string {
            return localStorage.getItem(this.LocalStorageKey);
        }
    }

    export class RestoreLastLocation extends SitecoreExtensions.Modules.ModuleBase implements SitecoreExtensions.Modules.ISitecoreExtensionsModule {
        canExecute(): boolean {
            return SitecoreExtensions.Context.Location() == Location.ContentEditor;
        }

        updateLastLocation(args: any): void {
            var id;
            for (let i = 0, l = args.path.length; i < l; i++) {
                let parent = args.path[i];
                if (parent.tagName && parent.tagName.toLowerCase() === "a") {
                    id = parent.id;
                    id = id.substring(id.lastIndexOf("_") + 1);
                    LastLocationStore.saveLastItemId(id);
                    break;
                }
            }
        }

        addTreeNodeHandlers(className: string): void {
            var nodes = document.getElementsByClassName(className);
            for (var i = 0; i < nodes.length; i++) {
                nodes[i].addEventListener('click', (evt) => {
                    this.updateLastLocation(evt);
                });
            }
        }

        initialize(): void {
            this.addTreeNodeHandlers('scContentTree');
        }
    }

    export class RestoreLastLocationCommandProvider implements ICommandsProvider {
        getCommands(): ICommand[] {
            var cmd: ICommand = {
                id: 0,
                name: "Restore Last Opened Item",
                description: "Restores last opened item in Content Editor",
                execute: () => {
                    var lastItem = LastLocationStore.loadLastItemId();
                    if (lastItem) {
                        scForm.postRequest("", "", "", "LoadItem(\"" + lastItem + "\")");
                    }
                },
                canExecute: () => { return SitecoreExtensions.Context.Location() == Location.ContentEditor; }
            };
            return [
                cmd
            ];
        }
    }
}

namespace SitecoreExtensions {
    import ISitecoreExtensionsModule = SitecoreExtensions.Modules.ISitecoreExtensionsModule;
    export class ExtensionsManager {
        modules: ISitecoreExtensionsModule[];
        constructor() {
            this.modules = new Array<ISitecoreExtensionsModule>();
        }

        addModule(module: ISitecoreExtensionsModule): void {
            this.modules.push(module);
        }

        initModules(): void {
            this.modules
                .filter(m => { return m.canExecute(); })
                .forEach(m => { m.initialize(); });
        }

        getModule(type: any): ISitecoreExtensionsModule {
            for (var index = 0; index < this.modules.length; index++) {
                var m = this.modules[index];
                if (m.constructor === type) {
                    return m;
                }
            }
            return null;
        }
    }

    export class Context {
        database: string;
        itemID: string;
        constructor() { }

        static IsValid(): boolean {
            return window.location.pathname.indexOf('/sitecore/') == 0 || Context.Location() == Location.ExperienceEditor;
        }

        static GetCurrentItem(): string {
            var element = <HTMLInputElement>document.querySelector('#__CurrentItem');
            return element.value;
        }

        static Database(): string {
            var pageMode = this.Location();
            if (pageMode == Location.ContentEditor) {
                var value = this.GetCurrentItem();
                return value.split('/').slice(2, 3)[0];
            }
            if (pageMode == Location.Desktop) {
                return (document.querySelector('.scDatabaseName') as HTMLDivElement).innerText;
            }
            if (pageMode == Location.ExperienceEditor) {
                var webEditRibbonIFrame = (document.querySelector('#scWebEditRibbon') as HTMLIFrameElement)
                if (webEditRibbonIFrame != null) {
                    var src = webEditRibbonIFrame.src
                    var start = src.indexOf("database=");
                    var end = src.indexOf("&", start);
                    return src.slice(start + 9, end)
                }
                var peBar = document.querySelector('[data-sc-id=PageEditBar]');
                if (peBar != null) {
                    return peBar.attributes['data-sc-database'].value
                }
            }
            else {
                var contendDb = <HTMLMetaElement>document.querySelector('[data-sc-name=sitecoreContentDatabase]')
                if (contendDb != null) {
                    if (contendDb.attributes['data-sc-content'] != undefined) {
                        return contendDb.attributes['data-sc-content'].value
                    }
                }
            }
            return null;
        }

        static ItemID(): string {
            var value = this.GetCurrentItem();
            return value.match(/{.*}/)[0];
        }

        static Location(): Location {
            if (typeof scContentEditor != 'undefined') {
                return Location.ContentEditor;
            }
            if (document.querySelector('.sc-launchpad') !== null) {
                return Location.Launchpad;
            }
            if (document.querySelector('input#__FRAMENAME') !== null) {
                return Location.Desktop;
            }
            if (document.querySelector('#scWebEditRibbon') !== null || document.querySelector('[data-sc-id=PageEditBar]') != null) {
                return Location.ExperienceEditor;
            }
            return Location.Unknown;
        }
    }

    export enum Location {
        ContentEditor,
        ExperienceEditor,
        Launchpad,
        Desktop,
        Unknown
    }
}


if (SitecoreExtensions.Context.IsValid()) {
    var scExtManager = new SitecoreExtensions.ExtensionsManager();
    var sectionSwitchesModule = new SitecoreExtensions.Modules.SectionSwitches.SectionSwitchesModule('Section Switches', 'Easily open/close all item sections with just one click');
    var dbNameModule = new SitecoreExtensions.Modules.DatabaseName.DatabaseNameModule('Database Name', 'Displays current database name in the Content Editor header');
    var launcher = new SitecoreExtensions.Modules.Launcher.LauncherModule('Launcher', 'Feel like power user using Sitecore Extensions command launcher.');
    var databaseColour = new SitecoreExtensions.Modules.DatabaseColor.DatabaseColorModule("Database Colour", 'Change the global header colour depeding on current database.');
    var lastLocation = new SitecoreExtensions.Modules.LastLocation.RestoreLastLocation("Restore Last Location", "Restores last opened item in Content Editor");

    scExtManager.addModule(sectionSwitchesModule);
    scExtManager.addModule(dbNameModule);
    scExtManager.addModule(launcher);
    scExtManager.addModule(databaseColour);
    scExtManager.addModule(lastLocation);

    scExtManager.initModules();


    launcher.registerProviderCommands(new SitecoreExtensions.Modules.SectionSwitches.SectionSwitchesCommandsProvider());
    launcher.registerProviderCommands(new SitecoreExtensions.Modules.LastLocation.RestoreLastLocationCommandProvider());

    window.postMessage({
        sc_ext_enabled: true,
        sc_ext_modules_count: scExtManager.modules.filter(m => { return m.canExecute(); }).length.toString()
    }, '*');
}
