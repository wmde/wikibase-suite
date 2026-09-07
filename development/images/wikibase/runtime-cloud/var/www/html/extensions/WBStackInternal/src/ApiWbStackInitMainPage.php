<?php

namespace WBStack\Internal;

/**
 * This class contains the text for a default wiki Main Page.
 */

class ApiWbStackInitMainPage {
    const TEXT = <<<EOF
<div style="width:98%; border:3px solid #0063bf; overflow:hidden; background-color: #FFFFFF; padding:16px 16px 16px 16px">
<div style="text-align:left; font-size:1.5em; color: #0063bf">Welcome to Wikibase Cloud!</div>
<div style="text-align:left;">This is your main page. For the start we have assembled some information for you that we think might be useful. This page is supposed to work for you. Feel free to change it to whatever you would like it to be. You can always copy its content to another place or just remove it entirely whenever you're ready. <br>
''We'd also be happy to hear if this page was helpful for you and/or what we could improve via [https://www.wikibase.cloud/contact our contact form]. Thanks!''</div>
</div>
__NOTOC__
= Where to start =
[https://www.mediawiki.org/wiki/Wikibase/Wikibase.cloud/First_steps Have a look at some possible first steps] you could take after creating your new wikibase.

==What do i need to know about how Wikibase works?==
===Wikibase ecosystem===
There are many Wikibases in the ecosystem. The community around Wikibase includes Wikibase users, partners, volunteer developers and tool builders, forming the vibrant and diverse Wikibase Ecosystem. In this ecosystem, we imagine that one day all the Wikibase instances will be connected between themselves and back to Wikidata. 
===How is information structured?===
Data is stored in Wikibase in the shape of Items. Each item is accorded its own page. Items are used to represent all the things in human knowledge, including topics, concepts, and objects. For example, the "1988 Summer Olympics", "love", "Elvis Presley", and "gorilla" can all be items. 
Items are made up of Statements that describe detailed characteristics of an Item. A statement (graph format: Subject-Predicate-Object) is how the information we know about an item - the data we have about it - gets recorded in your Wikibase instance. 
This happens by pairing a property with at least one value; this pair is at the heart of a statement. Statements also serve to connect items to each other, resulting in a linked data structure.

[https://upload.wikimedia.org/wikipedia/commons/6/60/Linked_Data_-_San_Francisco.svg Check out this visualization of the linked data structure]

The property in a statement describes the data value, and can be thought of as a category of data like "color", "population," or "Commons media" (files hosted on Wikimedia Commons). The value in the statement is the actual piece of data that describes the item. Each property has a [https://www.wikidata.org/wiki/Special:MyLanguage/Help:Data_type data type] which defines the kind of values allowed in statements with that property. For example, the property “date of birth” will only accept data in the format of a date.

[https://upload.wikimedia.org/wikipedia/commons/a/ae/Datamodel_in_Wikidata.svg Check out this visualisation of the structure of an item]

'''Example'''
In order to record information about the occupation of Marie Curie, you would need to add a statement to the item for [https://www.wikidata.org/wiki/Q7186 Marie Curie (Q7186)]. Using the property, [https://www.wikidata.org/wiki/Property:P106 occupation (P106)], you could then add the value [https://www.wikidata.org/wiki/Q169470 physicist (Q169470)]. You could also add the value [https://www.wikidata.org/wiki/Q593644 chemist (Q593644)]. Note how both chemist and physicist are each their own item, thereby allowing Marie Curie to be linked to these items.

== How to create items + properties + (what is a good property) ==
Create a new Item with [[Special:NewItem]] on the menu to the left. You will be taken to a page that asks you to give the new item a [https://www.wikidata.org/wiki/Wikidata:Glossary#Label label] and a [https://www.wikidata.org/wiki/Wikidata:Glossary#Description description]. When you're done, click "Create". 

Create the property with [[Special:NewProperty]].
Property entities can be edited like [https://www.wikidata.org/wiki/Special:MyLanguage/Help:Item item entities] with labels, descriptions, [https://www.wikidata.org/wiki/Special:MyLanguage/Help:Aliases aliases], and statements.
'''Property labels''' should be as unambiguous as possible so that it is clear to a user which property is the correct one to use when editing items and adding statements. Properties rarely refer to commonly known concepts but they are more constructs of the Wikidata with specific meanings. Unlike items, property labels must be unique.
'''Property descriptions''' are less relevant for disambiguation but they should provide enough information about the scope and context of the property so that users understand appropriate usage of the property without having to consult additional help.
'''Property aliases''' should include all alternative ways of referring to the property.

'''Example:'''
property: [https://www.wikidata.org/wiki/Property:P161 P161]
label: cast member
description: actor performing live for a camera or audience
aliases: film starring; actor; actress; starring

To create and delete data using tools, [https://www.mediawiki.org/wiki/Wikibase/Creating%20and%20deleting%20data have a look at this list in the documentation].

Another way is via the [https://www.mediawiki.org/wiki/Wikibase/API Wikibase API] that allows querying, adding, removing and editing information on Wikidata or any other Wikibase instance. A new version of the API is in the works with the [https://doc.wikimedia.org/Wikibase/master/php/repo%20rest-api%20README.html REST API].

== Don’t panic -> links to help ==
This is a lot of information and possibilities and might seem daunting. Don’t panic. There’s a lot of [https://www.mediawiki.org/wiki/Wikibase/Wikibase.cloud documentation] for you to read, [https://www.wikibase.cloud/discovery many other Wikibases you can look at] to get inspired, a [https://t.me/joinchat/FgqAnxNQYOeAKmyZTIId9g community] that is happy to help out with any questions, and [https://www.wikibase.cloud/contact the development team] who’s happy to support you where needed.

== Last but not least ==
To edit this page, make sure you are logged in and click on -edit- on the top right of this page to change or remove the content.     
EOF;
}

