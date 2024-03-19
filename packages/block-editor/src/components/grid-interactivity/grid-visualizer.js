/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { __experimentalUseDropZone as useDropZone } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { __unstableUseBlockElement as useBlockElement } from '../block-list/use-block-props/use-block-refs';
import BlockPopoverCover from '../block-popover/cover';
import { getComputedCSS, range, Rect } from './utils';
import { store as blockEditorStore } from '../../store';

export function GridVisualizer( { clientId } ) {
	const blockElement = useBlockElement( clientId );
	if ( ! blockElement ) {
		return null;
	}
	return (
		<GridVisualizerGrid
			clientId={ clientId }
			blockElement={ blockElement }
		/>
	);
}

function getGridInfo( blockElement ) {
	const gridTemplateColumns = getComputedCSS(
		blockElement,
		'grid-template-columns'
	);
	const gridTemplateRows = getComputedCSS(
		blockElement,
		'grid-template-rows'
	);
	const numColumns = gridTemplateColumns.split( ' ' ).length;
	const numRows = gridTemplateRows.split( ' ' ).length;
	const numItems = numColumns * numRows;
	return {
		numColumns,
		numRows,
		numItems,
		style: {
			gridTemplateColumns,
			gridTemplateRows,
			gap: getComputedCSS( blockElement, 'gap' ),
			padding: getComputedCSS( blockElement, 'padding' ),
		},
	};
}

function GridVisualizerGrid( { clientId, blockElement } ) {
	const [ gridInfo, setGridInfo ] = useState( () =>
		getGridInfo( blockElement )
	);
	const [ isDroppingAllowed, setIsDroppingAllowed ] = useState( false );
	const [ highlightedRect, setHighlightedRect ] = useState( null );

	const { getBlockAttributes } = useSelect( blockEditorStore );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	useEffect( () => {
		const observers = [];
		for ( const element of [ blockElement, ...blockElement.children ] ) {
			const observer = new window.ResizeObserver( () => {
				setGridInfo( getGridInfo( blockElement ) );
			} );
			observer.observe( element );
			observers.push( observer );
		}
		return () => {
			for ( const observer of observers ) {
				observer.disconnect();
			}
		};
	}, [ blockElement ] );

	useEffect( () => {
		function onGlobalDrag() {
			setIsDroppingAllowed( true );
		}
		function onGlobalDragEnd() {
			setIsDroppingAllowed( false );
		}
		document.addEventListener( 'drag', onGlobalDrag );
		document.addEventListener( 'dragend', onGlobalDragEnd );
		return () => {
			document.removeEventListener( 'drag', onGlobalDrag );
			document.removeEventListener( 'dragend', onGlobalDragEnd );
		};
	}, [] );

	return (
		<BlockPopoverCover
			className={ classnames( 'block-editor-grid-visualizer', {
				'is-dropping-allowed': isDroppingAllowed,
			} ) }
			clientId={ clientId }
			__unstablePopoverSlot="block-toolbar"
		>
			<div
				className="block-editor-grid-visualizer__grid"
				style={ gridInfo.style }
			>
				{ range( 1, gridInfo.numRows ).map( ( row ) =>
					range( 1, gridInfo.numColumns ).map( ( column ) => (
						<GridVisualizerCell
							key={ `${ row }-${ column }` }
							isHighlighted={
								highlightedRect?.contains(
									column - 1,
									row - 1
								) ?? false
							}
							validateDrag={ ( srcClientId ) => {
								const attributes =
									getBlockAttributes( srcClientId );
								const columnSpan =
									attributes.style?.layout?.columnSpan ?? 1;
								const rowSpan =
									attributes.style?.layout?.rowSpan ?? 1;
								return new Rect( {
									width: gridInfo.numColumns,
									height: gridInfo.numRows,
								} ).containsRect(
									new Rect( {
										x: column - 1,
										y: row - 1,
										width: columnSpan,
										height: rowSpan,
									} )
								);
							} }
							onDragEnter={ ( srcClientId ) => {
								const attributes =
									getBlockAttributes( srcClientId );
								const columnSpan =
									attributes.style?.layout?.columnSpan ?? 1;
								const rowSpan =
									attributes.style?.layout?.rowSpan ?? 1;
								setHighlightedRect(
									new Rect( {
										x: column - 1,
										y: row - 1,
										width: columnSpan,
										height: rowSpan,
									} )
								);
							} }
							onDragLeave={ () => {
								// onDragEnter can be called before onDragLeave if the user moves
								// their mouse quickly, so only clear the highlight if it was set
								// by this cell.
								setHighlightedRect( ( prevHighlightedRect ) =>
									prevHighlightedRect?.x === column - 1 &&
									prevHighlightedRect?.y === row - 1
										? null
										: prevHighlightedRect
								);
							} }
							onDrop={ ( srcClientId ) => {
								const attributes =
									getBlockAttributes( srcClientId );
								updateBlockAttributes( srcClientId, {
									style: {
										...attributes.style,
										layout: {
											...attributes.style?.layout,
											columnStart: column,
											rowStart: row,
										},
									},
								} );
								setHighlightedRect( null );
							} }
						/>
					) )
				) }
			</div>
		</BlockPopoverCover>
	);
}

function GridVisualizerCell( {
	isHighlighted,
	validateDrag,
	onDragEnter,
	onDragLeave,
	onDrop,
} ) {
	const { getDraggedBlockClientIds } = useSelect( blockEditorStore );

	const ref = useDropZone( {
		onDragEnter() {
			const [ srcClientId ] = getDraggedBlockClientIds();
			if ( srcClientId && validateDrag( srcClientId ) ) {
				onDragEnter( srcClientId );
			}
		},
		onDragLeave() {
			onDragLeave();
		},
		onDrop() {
			const [ srcClientId ] = getDraggedBlockClientIds();
			if ( srcClientId && validateDrag( srcClientId ) ) {
				onDrop( srcClientId );
			}
		},
	} );

	return (
		<div className="block-editor-grid-visualizer__cell">
			<div
				ref={ ref }
				className={ classnames(
					'block-editor-grid-visualizer__drop-zone',
					{
						'is-highlighted': isHighlighted,
					}
				) }
			/>
		</div>
	);
}
