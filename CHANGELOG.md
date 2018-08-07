## Change Log

### 1.1

##### Added

* You can now provide an array of trigger characters to handle multiple datasets (e.g.: '**@**' for people, '**#**' for records, '**$**' for products, etc.)  
    - New setting - **triggerChars** _(array)_:
        - an array of trigger characters the mentions will respond to, which you can associate to either the same dataset or multiple different datasets using ***onDataRequest***. (default ['@'])
* By setting ***minChars*** to 0, **mentionsInput** will now display the list of mentionable items instantly, limited to the maximum number of results set in **maxResults**. 

##### Removed

* *(string)* **triggerChar**: This has been replaced with *(array)* **triggerChars**. 

### 1.0.4
* You can now limit the number of results returned to make it more performant if you have lots of people you can mention
* You can now close the autocomplete window as part of your own code.

### 1.0.3
* Adjusts code to remove deprecated jQuery calls
* Adds functionality that autocompletes inputs if there's only one result and you press space
* Improves support for autocomplete on mobile devices (https://github.com/podio/jquery-mentions-input/issues/127)

---
## Podio Changelog 

### 1.0.2
* Various bugfixes

### 1.0.1
* Removed elastic-option since it wasn't really working without it. https://github.com/podio/jquery-mentions-input/issues/1)
Fixed issue with space on search queries. ( https://github.com/podio/jquery-mentions-input/issues/24)

### 1.0.0
* Initial release
    